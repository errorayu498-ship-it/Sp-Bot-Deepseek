const { PremiumEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { GiveawayManager } = require('../utils/giveawayManager');
const Guild = require('../models/Guild');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

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
            
            // Handle modals
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'prefix_modal') {
                    await handlePrefixModal(interaction, client);
                    return;
                }
            }
            
            // Handle select menus
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'prefix_select') {
                    await handlePrefixSelect(interaction, client);
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
    const action = interaction.customId.replace('panel_', '');
    
    // Prefix Management
    if (action === 'prefix_settings' || action === 'prefix_menu') {
        await showPrefixMenu(interaction);
        return;
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    const guildData = await Guild.findOne({ guildId: interaction.guild.id });
    const prefix = guildData?.settings?.prefix || '!';
    
    const panelActions = {
        'giveaway_create': {
            title: '🎉 Create Giveaway',
            description: 'Use `/cgw` command to create a new giveaway!\n\n**Example:**\n`/cgw prize:Nitro winners:1 duration:24h`\n\n**Optional Requirements:**\n• XP Requirement\n• Invite Requirement\n• Role Requirement'
        },
        'giveaway_list': {
            title: '📋 Active Giveaways',
            description: 'Use `/gwinfo` to see all giveaways!\n\n**Options:**\n• `/gwinfo active` - Show active giveaways\n• `/gwinfo ended` - Show ended giveaways\n• `/gwinfo all` - Show all giveaways'
        },
        'giveaway_end': {
            title: '⏹️ End Giveaway',
            description: 'Use `/endgw <giveaway_id>` to end a giveaway early!\n\n**Example:**\n`/endgw giveaway_id:1234`\n\nThis will immediately end the giveaway and pick winners.'
        },
        'giveaway_reroll': {
            title: '🔄 Reroll Giveaway',
            description: 'Use `/reroll <giveaway_id>` to pick new winners!\n\n**Example:**\n`/reroll giveaway_id:1234`\n\nThis will pick new random winners from the same entries.'
        },
        'xp_leaderboard': {
            title: '🏆 XP Leaderboard',
            description: `Use \`${prefix}leaderboard\` to see top XP earners!\n\n**Aliases:** \`${prefix}lb\``
        },
        'invite_leaderboard': {
            title: '👥 Invite Leaderboard',
            description: `Use \`${prefix}inviteleaderboard\` to see top inviters!\n\n**Aliases:** \`${prefix}ilb\``
        },
        'help': {
            title: '❓ Help Menu',
            description: `**Admin Commands:** \`/admhelp\`\n**Public Commands:** \`${prefix}help\`\n\nCurrent prefix is: \`${prefix}\``
        },
        'refresh': {
            title: '🔄 Panel Refreshed',
            description: `The panel information is up to date!\n\n**Current Settings:**\n• Prefix: \`${prefix}\`\n• XP Channel: ${guildData?.settings?.xpChannel ? `<#${guildData.settings.xpChannel}>` : 'Not Set'}\n• XP System: ${guildData?.settings?.xpEnabled ? '✅ Enabled' : '❌ Disabled'}`
        },
        'xp_add': {
            title: '⬆️ Add XP',
            description: 'Use `/addxp <user> <amount>` to add XP!\n\n**Example:**\n`/addxp user:@member amount:500`'
        },
        'xp_remove': {
            title: '⬇️ Remove XP',
            description: 'Use `/removexp <user> <amount>` to remove XP!\n\n**Example:**\n`/removexp user:@member amount:200`'
        },
        'xp_settings': {
            title: '⚙️ XP Settings',
            description: 'XP system is currently active!\n\n**Settings:**\n• XP per message: 5\n• Cooldown: 60 seconds\n• Level formula: 0.1 × √(Total XP)'
        },
        'invite_add': {
            title: '➕ Add Invites',
            description: 'Use `/addinvites <user> <amount>` to add invites!\n\n**Example:**\n`/addinvites user:@member amount:10`'
        },
        'invite_edit': {
            title: '✏️ Edit Invites',
            description: 'Use `/editinvites <user> <amount>` to set invite count!\n\n**Example:**\n`/editinvites user:@member amount:50`'
        },
        'settings': {
            title: '⚙️ Bot Settings',
            description: `**Current Configuration:**\n• Prefix: \`${prefix}\`\n• Admin Role: <@&${process.env.ADMIN_ROLE_ID}>\n• XP Channel: ${guildData?.settings?.xpChannel ? `<#${guildData.settings.xpChannel}>` : 'Not Set'}\n\nUse the buttons below to modify settings!`
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
            .setDescription(`This feature is coming soon!\n\nCurrent prefix: \`${prefix}\``);
        
        await interaction.editReply({ embeds: [embed] });
    }
}

async function showPrefixMenu(interaction) {
    const guildData = await Guild.findOne({ guildId: interaction.guild.id });
    const currentPrefix = guildData?.settings?.prefix || '!';
    
    const embed = new PremiumEmbed()
        .setTitle('🔧 Prefix Management')
        .setDescription(`**Current Prefix:** \`${currentPrefix}\`\n\nChoose an option below to change the bot prefix:`)
        .addField('📝 Custom Prefix', 'Click the button below to set a custom prefix')
        .addField('🎯 Quick Prefixes', 'Select from common prefixes using the dropdown menu')
        .setFooter({ text: 'Changes apply immediately without restart!' });
    
    const customPrefixButton = new ButtonBuilder()
        .setCustomId('panel_custom_prefix')
        .setLabel('Set Custom Prefix')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️');
    
    const resetButton = new ButtonBuilder()
        .setCustomId('panel_reset_prefix')
        .setLabel('Reset to !')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄');
    
    const row1 = new ActionRowBuilder().addComponents(customPrefixButton, resetButton);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('prefix_select')
        .setPlaceholder('Select a quick prefix')
        .addOptions([
            new StringSelectMenuOptionBuilder()
                .setLabel('Exclamation Mark')
                .setDescription('Use ! as prefix')
                .setValue('!')
                .setEmoji('❗'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Question Mark')
                .setDescription('Use ? as prefix')
                .setValue('?')
                .setEmoji('❓'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Dot')
                .setDescription('Use . as prefix')
                .setValue('.')
                .setEmoji('🔘'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Dash')
                .setDescription('Use - as prefix')
                .setValue('-')
                .setEmoji('➖'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Slash')
                .setDescription('Use / as prefix (Not recommended)')
                .setValue('/')
                .setEmoji('⚡')
        ]);
    
    const row2 = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({ 
        embeds: [embed], 
        components: [row1, row2], 
        ephemeral: true 
    });
    
    // Handle custom prefix button
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
    
    collector.on('collect', async (i) => {
        if (i.customId === 'panel_custom_prefix') {
            await showPrefixModal(i);
            collector.stop();
        } else if (i.customId === 'panel_reset_prefix') {
            await resetPrefix(i, interaction.guild.id);
            collector.stop();
        }
    });
}

async function showPrefixModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('prefix_modal')
        .setTitle('Change Bot Prefix');
    
    const prefixInput = new TextInputBuilder()
        .setCustomId('new_prefix')
        .setLabel('Enter new prefix')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., ! ? . - $')
        .setMinLength(1)
        .setMaxLength(5)
        .setRequired(true);
    
    const firstRow = new ActionRowBuilder().addComponents(prefixInput);
    
    modal.addComponents(firstRow);
    
    await interaction.showModal(modal);
}

async function handlePrefixModal(interaction, client) {
    const newPrefix = interaction.fields.getTextInputValue('new_prefix');
    
    // Validate prefix
    const invalidPrefixes = ['/', '\\', '@', '#', '*', '`', '~'];
    if (invalidPrefixes.includes(newPrefix)) {
        const errorEmbed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Invalid Prefix')
            .setDescription(`The prefix \`${newPrefix}\` is not allowed as it may conflict with Discord formatting.`)
            .addField('Allowed Characters', 'Letters, numbers, and most symbols except: / \\ @ # * ` ~');
        
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    await updatePrefix(interaction.guild.id, newPrefix);
    
    const successEmbed = new PremiumEmbed()
        .setSuccess()
        .setTitle('✅ Prefix Updated!')
        .setDescription(`Bot prefix has been changed to \`${newPrefix}\``)
        .addField('📝 New Commands Format', 
            `• \`${newPrefix}xp\` - Check XP\n` +
            `• \`${newPrefix}leaderboard\` - XP Leaderboard\n` +
            `• \`${newPrefix}invite\` - Check invites\n` +
            `• \`${newPrefix}help\` - Help menu`)
        .setFooter({ text: 'Changes applied immediately without restart!' });
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
}

async function handlePrefixSelect(interaction, client) {
    const newPrefix = interaction.values[0];
    
    await updatePrefix(interaction.guild.id, newPrefix);
    
    const successEmbed = new PremiumEmbed()
        .setSuccess()
        .setTitle('✅ Prefix Updated!')
        .setDescription(`Bot prefix has been changed to \`${newPrefix}\``)
        .addField('📝 New Commands Format', 
            `• \`${newPrefix}xp\` - Check XP\n` +
            `• \`${newPrefix}leaderboard\` - XP Leaderboard\n` +
            `• \`${newPrefix}invite\` - Check invites\n` +
            `• \`${newPrefix}help\` - Help menu`)
        .setFooter({ text: 'Changes applied immediately without restart!' });
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
}

async function resetPrefix(interaction, guildId) {
    await updatePrefix(guildId, '!');
    
    const successEmbed = new PremiumEmbed()
        .setSuccess()
        .setTitle('✅ Prefix Reset!')
        .setDescription('Bot prefix has been reset to `!`')
        .addField('📝 Commands Format', 
            '• `!xp` - Check XP\n' +
            '• `!leaderboard` - XP Leaderboard\n' +
            '• `!invite` - Check invites\n' +
            '• `!help` - Help menu')
        .setFooter({ text: 'Changes applied immediately without restart!' });
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
}

async function updatePrefix(guildId, newPrefix) {
    await Guild.findOneAndUpdate(
        { guildId: guildId },
        { $set: { 'settings.prefix': newPrefix } },
        { upsert: true, new: true }
    );
    
    logger.info(`Prefix updated to "${newPrefix}" for guild ${guildId}`);
}
