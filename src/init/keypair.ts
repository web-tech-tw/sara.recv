// Reading curve keypair.
import {readFileSync} from "node:fs";
import * as constants from "./const";

export const usePublicKey = () =>
    readFileSync(constants.PUBLIC_KEY_FILENAME);

export const usePrivateKey = () =>
    readFileSync(constants.PRIVATE_KEY_FILENAME);
