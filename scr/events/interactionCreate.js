const { PremiumEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { GiveawayManager } = require('../utils/giveawayManager');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = client.slashCommands.get(interaction.commandName);
                
                if (!command) {
                    return interaction.reply({ 
                        content: 'Command not found.', 
                        ephemeral: true 
                    });
                }
                
                // Admin permission check
                if (command.adminOnly) {
                    const adminRole = process.env.ADMIN_ROLE_ID;
                    if (!interaction.member.roles.cache.has(adminRole)) {
                        const errorEmbed = new PremiumEmbed()
                            .setError()
                            .setTitle('Permission Denied')
                            .setDescription('You do not have permission to use this command.');
                        
                        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                    }
                }
                
                await command.execute(interaction, client);
            }
            
            // Handle buttons
            if (interaction.isButton()) {
                if (interaction.customId.startsWith('giveaway_')) {
                    await GiveawayManager.handleGiveawayButton(interaction, client);
                }
                
                if (interaction.customId.startsWith('panel_')) {
                    await handlePanelButton(interaction, client);
                }
            }
            
        } catch (error) {
            logger.error('Interaction Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('Interaction Failed')
                .setDescription('An error occurred while processing this interaction.')
                .addField('Error', error.message.slice(0, 1000));
            
            const reply = {
                embeds: [errorEmbed],
                ephemeral: true
            };
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
};

async function handlePanelButton(interaction, client) {
    const action = interaction.customId.replace('panel_', '');
    
    const panelActions = {
        'giveaway_create': () => {
            return {
                title: 'Create Giveaway',
                description: 'Use `/cgw` command to create a new giveaway!'
            };
        },
        'giveaway_list': () => {
            return {
                title: 'Active Giveaways',
                description: 'Use `/gwinfo` to see all giveaways!'
            };
        },
        'xp_leaderboard': () => {
            return {
                title: 'XP Leaderboard',
                description: 'Use `!leaderboard` to see top XP earners!'
            };
        },
        'invite_leaderboard': () => {
            return {
                title: 'Invite Leaderboard',
                description: 'Use `!inviteleaderboard` to see top inviters!'
            };
        },
        'help': () => {
            return {
                title: 'Help Menu',
                description: 'Use `/admhelp` for admin commands or `!help` for public commands!'
            };
        }
    };
    
    const actionHandler = panelActions[action];
    
    if (actionHandler) {
        const data = actionHandler();
        const embed = new PremiumEmbed()
            .setInfo()
            .setTitle(data.title)
            .setDescription(data.description);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
