const { logger } = require('../utils/logger');
const { GiveawayManager } = require('../utils/giveawayManager');
const { EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.success(`${client.user.tag} is online and ready!`);
        
        // Load active giveaways
        await GiveawayManager.loadGiveaways(client);
        
        // Cache invites for all guilds
        for (const guild of client.guilds.cache.values()) {
            try {
                const invites = await guild.invites.fetch();
                client.invites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
                logger.info(`Cached ${invites.size} invites for ${guild.name}`);
                
                // Send bot online log
                const guildData = await Guild.findOne({ guildId: guild.id });
                if (guildData?.settings?.logChannel) {
                    const channel = await guild.channels.fetch(guildData.settings.logChannel).catch(() => null);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🤖 Bot Online')
                            .setDescription(`${client.user.tag} is now online and ready!`)
                            .addFields(
                                { name: 'Guild', value: guild.name, inline: true },
                                { name: 'Members', value: `${guild.memberCount}`, inline: true },
                                { name: 'Prefix', value: guildData.settings.prefix || '!', inline: true }
                            )
                            .setTimestamp();
                        
                        await channel.send({ embeds: [embed] }).catch(() => {});
                    }
                }
            } catch (error) {
                logger.error(`Failed to cache invites for ${guild.name}:`, error);
            }
        }
        
        logger.info(`Loaded ${client.giveaways.size} active giveaways`);
        logger.info(`Bot is running on ${client.guilds.cache.size} servers`);
    }
};
