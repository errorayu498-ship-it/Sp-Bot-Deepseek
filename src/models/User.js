const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    totalXp: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    lastMessage: { type: Date, default: Date.now },
    invites: {
        total: { type: Number, default: 0 },
        regular: { type: Number, default: 0 },
        leaves: { type: Number, default: 0 },
        fake: { type: Number, default: 0 },
        bonus: { type: Number, default: 0 }
    },
    invitedUsers: [{
        userId: String,
        joinedAt: Date,
        leftAt: Date,
        isValid: { type: Boolean, default: true }
    }],
    cooldowns: {
        xp: { type: Date, default: null }
    }
}, { timestamps: true });

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
