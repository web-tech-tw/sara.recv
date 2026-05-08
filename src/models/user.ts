import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPasskey {
    id: string;
    label: string;
    publicKey: Buffer;
    counter: number;
    transports: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUser extends Document {
    email: string;
    nickname: string;
    roles: string[];
    revision: number;
    passkeys: IPasskey[];
    avatar_hash?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PasskeySchema = new Schema<IPasskey>({
    id: { type: String, required: true },
    label: { type: String, required: true },
    publicKey: { 
        type: Buffer, 
        required: true,
        set: (val: any) => Buffer.from(val)
    },
    counter: { type: Number, required: true },
    transports: { type: [String], required: true },
}, {
    _id: false,
    timestamps: true,
});

const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true },
    nickname: { type: String, required: true },
    roles: { type: [String], default: [] },
    revision: { type: Number, default: 0 },
    passkeys: { type: [PasskeySchema], default: [] },
}, {
    timestamps: true,
});

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
