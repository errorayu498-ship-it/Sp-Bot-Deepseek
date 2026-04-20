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
                            .setTitle('❌ Permission Denied')
                            .setDescription('You do not have permission to use this command.');
                        
                        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                    }
                }
                
                await command.execute(interaction, client);
            }
            
            // Handle buttons
            if (interaction.isButton()) {
                const customId = interaction.customId;
                
                if (customId.startsWith('giveaway_enter_')) {
                    await GiveawayManager.handleGiveawayButton(interaction, client);
                    return;
                }
                
                if (customId.startsWith('panel_')) {
                    await handlePanelButton(interaction, client);
                    return;
                }
            }
            
        } catch (error) {
            logger.error('Interaction Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Interaction Failed')
                .setDescription('An error occurred while processing this interaction.')
                .addField('Error Details', error.message.slice(0, 1000) || 'Unknown error');
            
            const reply = {
                embeds: [errorEmbed],
                ephemeral: true
            };
            
            try {
                if (interaction.deferred) {
                    await interaction.editReply(reply);
                } else if (!interaction.replied) {
                    await interaction.reply(reply);
                }
            } catch (e) {
                logger.error('Failed to send error response:', e);
            }
        }
    }
};

async function handlePanelButton(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const action = interaction.customId.replace('panel_', '');
    
    const panelActions = {
        'giveaway_create': {
            title: '🎉 Create Giveaway',
            description: 'Use `/cgw` command to create a new giveaway!\n\n**Example:**\n`/cgw prize:Nitro winners:1 duration:24h`'
        },
        'giveaway_list': {
            title: '📋 Active Giveaways',
            description: 'Use `/gwinfo` to see all giveaways!'
        },
        'xp_leaderboard': {
            title: '🏆 XP Leaderboard',
            description: 'Use `!leaderboard` to see top XP earners!'
        },
        'invite_leaderboard': {
            title: '👥 Invite Leaderboard',
            description: 'Use `!inviteleaderboard` to see top inviters!'
        },
        'help': {
            title: '❓ Help Menu',
            description: 'Use `/admhelp` for admin commands or `!help` for public commands!'
        },
        'refresh': {
            title: '🔄 Panel Refreshed',
            description: 'The panel information is up to date!'
        }
    };
    
    const actionHandler = panelActions[action];
    
    if (actionHandler) {
        const embed = new PremiumEmbed()
            .setInfo()
            .setTitle(actionHandler.title)
            .setDescription(actionHandler.description);
        
        await interaction.editReply({ embeds: [embed] });
    } else {
        const embed = new PremiumEmbed()
            .setWarning()
            .setTitle('⚠️ Unknown Action')
            .setDescription('This feature is coming soon!');
        
        await interaction.editReply({ embeds: [embed] });
    }
}
