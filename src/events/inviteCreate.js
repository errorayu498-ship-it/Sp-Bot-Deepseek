const { logger } = require('../utils/logger');

module.exports = {
    name: 'inviteCreate',
    async execute(invite, client) {
        try {
            // Update invite cache
            const guildInvites = client.invites.get(invite.guild.id) || new Map();
            guildInvites.set(invite.code, invite.uses);
            client.invites.set(invite.guild.id, guildInvites);
            
            logger.debug(`New invite created by ${invite.inviter?.username}: ${invite.code}`);
        } catch (error) {
            logger.error('Invite Create Error:', error);
        }
    }
};
