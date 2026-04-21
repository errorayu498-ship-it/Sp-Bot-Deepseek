const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    name: String,
    settings: {
        prefix: { type: String, default: '!' },
        xpChannel: { type: String, default: null },
        xpEnabled: { type: Boolean, default: true },
        xpPerMessage: { type: Number, default: 5 },
        xpCooldown: { type: Number, default: 2 },
        antiSpamEnabled: { type: Boolean, default: true },
        inviteTracking: { type: Boolean, default: true },
        adminRoles: [String],
        giveawayManagerRoles: [String],
        logChannel: { type: String, default: null },
        inviteLogChannel: { type: String, default: null },
        levelUpChannel: { type: String, default: null }
    },
    stats: {
        totalGiveaways: { type: Number, default: 0 },
        totalXpGiven: { type: Number, default: 0 },
        totalInvites: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model('Guild', guildSchema);
