const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removebl')
        .setDescription('Remove a member from the blacklist')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('The User ID to remove from blacklist')
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.options.getString('user_id').trim();
        
        try {
            // Find guild data
            let guildData = await Guild.findOne({ guildId: interaction.guild.id });
            
            if (!guildData || !guildData.blacklist || guildData.blacklist.length === 0) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ No Blacklisted Users')
                    .setDescription('There are no blacklisted users in this server.');
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Find the blacklisted user
            const blacklistEntry = guildData.blacklist.find(b => b.userId === userId);
            
            if (!blacklistEntry) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ User Not Found')
                    .setDescription(`User ID \`${userId}\` is not in the blacklist.`);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Remove from blacklist
            guildData.blacklist = guildData.blacklist.filter(b => b.userId !== userId);
            await guildData.save();
            
            // Try to fetch user
            const target = await interaction.client.users.fetch(userId).catch(() => null);
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ User Removed from Blacklist')
                .setDescription(`${target?.tag || userId} has been removed from the blacklist!`)
                .addField('👤 User', target ? `${target}` : 'Unknown', true)
                .addField('🆔 User ID', userId, true)
                .addField('📝 Was Blacklisted For', blacklistEntry.reason || 'No reason', true)
                .addField('📅 Was Blacklisted Since', `<t:${Math.floor(new Date(blacklistEntry.addedAt).getTime() / 1000)}:R>`, true)
                .addField('✅ Effects Restored', 
                    '• Can earn XP again\n' +
                    '• Can use public commands\n' +
                    '• Full access restored'
                )
                .setFooter({ text: `Remaining Blacklisted: ${guildData.blacklist.length}` })
                .setTimestamp();
            
            if (target) {
                embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
            }
            
            await interaction.editReply({ embeds: [embed] });
            
            // Send log if log channel is set
            if (guildData.settings?.logChannel) {
                const { EmbedBuilder } = require('discord.js');
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ User Unblacklisted')
                    .setDescription(`${target?.tag || userId} has been removed from blacklist!`)
                    .addFields(
                        { name: 'User', value: target?.tag || userId, inline: true },
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Removed By', value: `${interaction.user.tag}`, inline: true }
                    )
                    .setTimestamp();
                
                const logChannel = await interaction.guild.channels.fetch(guildData.settings.logChannel).catch(() => null);
                if (logChannel) {
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
            
        } catch (error) {
            console.error('Remove Blacklist Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Failed to remove user from blacklist. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
