import mongoose, {Schema, Document, Model, Types} from "mongoose";

export interface IToken extends Document {
    userId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const TokenSchema = new Schema<IToken>({
    userId: {type: Schema.Types.ObjectId, required: true},
}, {
    timestamps: true,
    expires: "1d",
});

export const Token: Model<IToken> = mongoose.models.Token ||
    mongoose.model<IToken>("Token", TokenSchema);
export default Token;
