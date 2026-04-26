const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkbl')
        .setDescription('View all blacklisted members')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('Check if specific user is blacklisted (optional)')
                .setRequired(false)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.options.getString('user_id');
        
        try {
            const guildData = await Guild.findOne({ guildId: interaction.guild.id });
            
            if (!guildData || !guildData.blacklist || guildData.blacklist.length === 0) {
                const embed = new PremiumEmbed()
                    .setInfo()
                    .setTitle('📋 Blacklist Status')
                    .setDescription('✅ No users are blacklisted in this server!')
                    .setFooter({ text: 'Server is clean!' });
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Agar specific user check karna hai
            if (userId) {
                const blacklistEntry = guildData.blacklist.find(b => b.userId === userId.trim());
                
                if (!blacklistEntry) {
                    const embed = new PremiumEmbed()
                        .setSuccess()
                        .setTitle('✅ User Not Blacklisted')
                        .setDescription(`User ID \`${userId}\` is **NOT** in the blacklist.`)
                        .addField('Status', '🟢 Clean', true);
                    
                    return interaction.editReply({ embeds: [embed] });
                }
                
                const target = await interaction.client.users.fetch(userId.trim()).catch(() => null);
                
                const embed = new PremiumEmbed()
                    .setError()
                    .setTitle('🚫 User is Blacklisted')
                    .setDescription(`${target?.tag || userId} is currently blacklisted!`)
                    .addField('👤 User', target ? `${target}` : 'Unknown', true)
                    .addField('🆔 User ID', userId, true)
                    .addField('📝 Reason', blacklistEntry.reason || 'No reason', true)
                    .addField('👮 Blacklisted By', `<@${blacklistEntry.addedBy}>`, true)
                    .addField('📅 Blacklisted At', `<t:${Math.floor(new Date(blacklistEntry.addedAt).getTime() / 1000)}:F>`, true)
                    .addField('⏰ Blacklisted Since', `<t:${Math.floor(new Date(blacklistEntry.addedAt).getTime() / 1000)}:R>`, true)
                    .setTimestamp();
                
                if (target) {
                    embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
                }
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Saare blacklisted users dikhao
            const embed = new PremiumEmbed()
                .setTitle('🚫 Blacklisted Members')
                .setDescription(`Total blacklisted users: **${guildData.blacklist.length}**`)
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();
            
            // Paginate if more than 10
            const blacklistEntries = guildData.blacklist.slice(0, 25); // Max 25 per embed
            
            let blacklistText = '';
            let count = 1;
            
            for (const entry of blacklistEntries) {
                const target = await interaction.client.users.fetch(entry.userId).catch(() => null);
                const username = target?.username || 'Unknown';
                const tag = target ? `${target.tag}` : 'Unknown#0000';
                
                blacklistText += `**${count}.** ${target ? `<@${entry.userId}>` : '`Unknown User`'}\n`;
                blacklistText += `   ├ Name: **${username}**\n`;
                blacklistText += `   ├ ID: \`${entry.userId}\`\n`;
                blacklistText += `   ├ Reason: ${entry.reason || 'No reason'}\n`;
                blacklistText += `   ├ Added By: <@${entry.addedBy}>\n`;
                blacklistText += `   └ Added: <t:${Math.floor(new Date(entry.addedAt).getTime() / 1000)}:R>\n\n`;
                count++;
            }
            
            embed.setDescription(blacklistText || 'No blacklisted users found.');
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Check Blacklist Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Failed to fetch blacklist. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
