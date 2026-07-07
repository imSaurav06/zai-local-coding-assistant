const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        prompt: {
            type: String,
            required: true,
        },
        response: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ["chat", "code", "project"],
            required: true,
        },
        model: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Ensure the virtual getter for 'id' is defined
if (!historySchema.options.toJSON) historySchema.options.toJSON = {};
historySchema.options.toJSON.transform = function (doc, ret, options) {
    ret.id = ret._id;
    return ret;
};

const History = mongoose.model("History", historySchema);

module.exports = History;
