const { logger } = require('../utils/logger');
const { GiveawayManager } = require('../utils/giveawayManager');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.success(`${client.user.tag} is online and ready!`);
        
        // Load active giveaways
        await GiveawayManager.loadGiveaways(client);
        
        // Cache invites
        const invites = await client.guilds.cache.get(process.env.GUILD_ID)?.invites.fetch();
        if (invites) {
            client.invites.set(process.env.GUILD_ID, new Map(invites.map(invite => [invite.code, invite.uses])));
        }
        
        logger.info(`Loaded ${client.giveaways.size} active giveaways`);
        logger.info(`Loaded invite cache for ${client.invites.size} guilds`);
    }
};
