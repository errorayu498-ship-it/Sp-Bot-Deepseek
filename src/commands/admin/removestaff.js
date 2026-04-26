const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removestaff')
        .setDescription('Remove a member from staff')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('The User ID to remove from staff')
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.options.getString('user_id').trim();
        
        try {
            // Get guild data
            let guildData = await Guild.findOne({ guildId: interaction.guild.id });
            
            if (!guildData || !guildData.staff || guildData.staff.length === 0) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ No Staff Members')
                    .setDescription('There are no staff members in this server.');
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Find staff member
            const staffIndex = guildData.staff.findIndex(s => s.userId === userId);
            
            if (staffIndex === -1) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Not Found')
                    .setDescription(`User ID \`${userId}\` is not in the staff list.`);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Remove from staff
            const removedStaff = guildData.staff[staffIndex];
            guildData.staff.splice(staffIndex, 1);
            await guildData.save();
            
            const target = await interaction.client.users.fetch(userId).catch(() => null);
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ Staff Member Removed')
                .setDescription(`${target?.tag || userId} has been removed from staff!`)
                .addField('👤 User', target ? `${target}` : 'Unknown', true)
                .addField('🆔 User ID', userId, true)
                .addField('👮 Removed By', `${interaction.user.tag}`, true)
                .addField('📅 Was Staff Since', `<t:${Math.floor(new Date(removedStaff.addedAt).getTime() / 1000)}:R>`, true)
                .addField('⚠️ Note', 'They can no longer use staff commands')
                .setFooter({ text: `Remaining Staff: ${guildData.staff.length}` })
                .setTimestamp();
            
            if (target) {
                embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
            }
            
            await interaction.editReply({ embeds: [embed] });
            
            // Log
            if (guildData.settings?.logChannel) {
                const { EmbedBuilder } = require('discord.js');
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('👮 Staff Member Removed')
                    .setDescription(`${target?.tag || userId} has been removed from staff!`)
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
            console.error('Remove Staff Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Failed to remove staff member. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
