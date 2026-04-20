const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    giveawayId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    prize: { type: String, required: true },
    winners: { type: Number, required: true },
    hostId: { type: String, required: true },
    requirements: {
        xp: { type: Number, default: 0 },
        invites: { type: Number, default: 0 },
        role: { type: String, default: null }
    },
    entries: [{
        userId: String,
        username: String,
        joinedAt: { type: Date, default: Date.now }
    }],
    winnersList: [{
        userId: String,
        username: String,
        announcedAt: Date
    }],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { 
        type: String, 
        enum: ['active', 'ended', 'cancelled'], 
        default: 'active' 
    },
    rerollCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Giveaway', giveawaySchema);
