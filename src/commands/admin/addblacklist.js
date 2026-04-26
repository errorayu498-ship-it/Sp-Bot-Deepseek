const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addblacklist')
        .setDescription('Add a member to the blacklist (no XP, no public commands)')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('The User ID to blacklist')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for blacklisting')
                .setRequired(false)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.options.getString('user_id').trim();
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        try {
            // Try to fetch user
            const target = await interaction.client.users.fetch(userId).catch(() => null);
            
            if (!target) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Invalid User ID')
                    .setDescription(`Could not find a user with ID: \`${userId}\``);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Check if user is admin (admin role walon ko blacklist nahi kar sakte)
            const adminRole = process.env.ADMIN_ROLE_ID;
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            
            if (member && adminRole && member.roles.cache.has(adminRole)) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Cannot Blacklist Admin')
                    .setDescription(`You cannot blacklist a server admin!`);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Check if already blacklisted
            let guildData = await Guild.findOne({ guildId: interaction.guild.id });
            
            if (!guildData) {
                guildData = new Guild({ guildId: interaction.guild.id, name: interaction.guild.name });
            }
            
            const alreadyBlacklisted = guildData.blacklist?.some(b => b.userId === userId);
            
            if (alreadyBlacklisted) {
                const errorEmbed = new PremiumEmbed()
                    .setWarning()
                    .setTitle('⚠️ Already Blacklisted')
                    .setDescription(`${target.tag} is already in the blacklist!`)
                    .addField('👤 User', `${target}`, true)
                    .addField('🆔 User ID', userId, true);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Add to blacklist
            guildData.blacklist.push({
                userId: userId,
                username: target.username,
                reason: reason,
                addedBy: interaction.user.id,
                addedAt: new Date()
            });
            
            await guildData.save();
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ User Blacklisted')
                .setDescription(`${target.tag} has been added to the blacklist!`)
                .addField('👤 User', `${target}`, true)
                .addField('🆔 User ID', userId, true)
                .addField('📝 Reason', reason, true)
                .addField('👮 Added By', `${interaction.user.tag}`, true)
                .addField('⚠️ Effects', 
                    '• Cannot earn XP\n' +
                    '• Cannot use public commands\n' +
                    '• Can still see and chat'
                )
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Total Blacklisted: ${guildData.blacklist.length}` })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Send log if log channel is set
            if (guildData.settings?.logChannel) {
                const { EmbedBuilder } = require('discord.js');
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🚫 User Blacklisted')
                    .setDescription(`${target.tag} has been blacklisted!`)
                    .addFields(
                        { name: 'User', value: `${target.tag}`, inline: true },
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Added By', value: `${interaction.user.tag}`, inline: true }
                    )
                    .setTimestamp();
                
                const logChannel = await interaction.guild.channels.fetch(guildData.settings.logChannel).catch(() => null);
                if (logChannel) {
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
            
        } catch (error) {
            console.error('Add Blacklist Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Failed to add user to blacklist. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
