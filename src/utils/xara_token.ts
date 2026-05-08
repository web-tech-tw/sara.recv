import { getMust } from "../config";
import { createHmac } from "node:crypto";
import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";
import { APP_NAME as issuerIdentity } from "../init/const";
import { usePublicKey, usePrivateKey } from "../init/keypair";
import User from "../models/user";
import Token from "../models/token";

const hmac256hex = (data: string, key: string) =>
    createHmac("sha256", key).update(data).digest("hex");

const issueOptions: SignOptions = {
    algorithm: "ES256",
    expiresIn: "1d",
    notBefore: "500ms",
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    noTimestamp: false,
};

const updateOptions: SignOptions = {
    algorithm: "ES256",
    noTimestamp: false,
};

const validateOptions: VerifyOptions = {
    algorithms: ["ES256"],
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    complete: true,
};

export interface TokenPayload {
    user: any;
    sub: string;
    jti: string;
}

export async function issue(userData: any): Promise<string> {
    const user = {
        _id: userData._id,
        email: userData.email,
        nickname: userData.nickname,
        avatar_hash: userData.avatar_hash,
        roles: userData.roles,
        created_at: userData.createdAt,
        updated_at: userData.updatedAt,
    };

    const userId = userData._id;
    const userRevision = userData.revision;

    const privateKey = usePrivateKey();
    const guardSecret = getMust("SARA_GUARD_SECRET");

    const token = new Token({ userId });
    const tokenIdPrefix = (await token.save()).id;
    const tokenIdSuffix = userRevision;
    const tokenId = `${tokenIdPrefix}/${tokenIdSuffix}`;

    const saraTokenPayload: TokenPayload = { user, sub: userId, jti: tokenId };
    const saraToken = jwt.sign(saraTokenPayload, privateKey, issueOptions);
    const guardToken = hmac256hex(tokenId, guardSecret);

    return `${saraToken}|${guardToken}`;
}

export function update(token: string, userData: any): string {
    const user = {
        _id: userData._id,
        email: userData.email,
        nickname: userData.nickname,
        avatar_hash: userData.avatar_hash,
        roles: userData.roles,
        created_at: userData.createdAt,
        updated_at: userData.updatedAt,
    };

    const userId = userData._id.toString();
    const userRevision = userData.revision;

    const publicKey = usePublicKey();
    const privateKey = usePrivateKey();
    const guardSecret = getMust("SARA_GUARD_SECRET");

    const [originalSaraToken, originalGuardToken] = token.split("|", 2);

    const verified = jwt.verify(originalSaraToken, publicKey, validateOptions) as any;
    const saraTokenPayload = verified.payload as TokenPayload;

    if (userId !== saraTokenPayload.sub) {
        throw new Error("unexpected user id");
    }

    const expectedOriginalGuardToken = hmac256hex(
        saraTokenPayload.jti,
        guardSecret,
    );
    if (originalGuardToken !== expectedOriginalGuardToken) {
        throw new Error("unexpected guard token");
    }

    const [originalTokenIdPrefix, originalTokenIdSuffix] = saraTokenPayload.jti.split("/", 2);
    const tokenId = `${originalTokenIdPrefix}/${userRevision}`;

    if (userRevision <= parseInt(originalTokenIdSuffix)) {
        throw new Error("unexpected user version");
    }

    saraTokenPayload.jti = tokenId;
    saraTokenPayload.user = {
        ...saraTokenPayload.user,
        ...user,
    };

    const saraToken = jwt.sign(saraTokenPayload, privateKey, updateOptions);
    const guardToken = hmac256hex(tokenId, guardSecret);

    return `${saraToken}|${guardToken}`;
}

export async function validate(token: string) {
    const publicKey = usePublicKey();
    const result: {
        userId: string | null;
        payload: any;
        isAborted: boolean;
    } = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const [saraToken, guardToken] = token.split("|", 2);
        const verified = jwt.verify(saraToken, publicKey, validateOptions) as any;
        const payload = verified.payload as TokenPayload;

        const guardSecret = getMust("SARA_GUARD_SECRET");
        const guardTokenExpected = hmac256hex(payload.jti, guardSecret);
        if (guardToken !== guardTokenExpected) {
            throw new Error("unexpected guard token");
        }

        const [tokenIdPrefix, tokenIdSuffix] = payload.jti.split("/", 2);

        const tokenState = await Token.findById(tokenIdPrefix);
        if (!tokenState) {
            throw new Error("token not found");
        }

        const user = await User.findById(tokenState.userId);
        if (!user) {
            throw new Error("user not found");
        }

        if (user.revision !== parseInt(tokenIdSuffix)) {
            throw new Error("user revision mismatch");
        }

        result.userId = payload.sub;
        result.payload = {
            profile: payload.user,
        };
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}
