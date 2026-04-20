const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admhelp')
        .setDescription('View all admin commands'),
    
    adminOnly: true,
    
    async execute(interaction) {
        const embed = new PremiumEmbed()
            .setTitle('🔧 Admin Commands Help')
            .setDescription('Here are all available admin commands:')
            .addField('🎉 Giveaway Commands',
                '`/cgw` - Create a new giveaway\n' +
                '`/endgw <id>` - End a giveaway early\n' +
                '`/reroll <id>` - Reroll giveaway winners\n' +
                '`/delgw <id>` - Delete a giveaway\n' +
                '`/gwinfo [type]` - View giveaway information'
            )
            .addField('📊 XP System Commands',
                '`/addxp <user> <amount>` - Add XP to a user\n' +
                '`/removexp <user> <amount>` - Remove XP from a user'
            )
            .addField('📨 Invite System Commands',
                '`/addinvites <user> <amount>` - Add invites to a user\n' +
                '`/editinvites <user> <amount>` - Set user\'s invite count'
            )
            .addField('🛠️ Control Commands',
                '`/panel` - Open admin control panel\n' +
                '`/admhelp` - Show this help menu'
            )
            .addField('📝 Public Commands (Prefix: !)',
                '`!xp` - Check your XP\n' +
                '`!checkxp @user` - Check someone\'s XP\n' +
                '`!leaderboard` - View XP leaderboard\n' +
                '`!invite` - Check your invites\n' +
                '`!checkinvite @user` - Check someone\'s invites\n' +
                '`!inviteleaderboard` - View invite leaderboard\n' +
                '`!help` - Public help menu'
            )
            .addField('💡 Tips',
                '• All slash commands require admin role\n' +
                '• Giveaway IDs are 4-digit numbers\n' +
                '• XP is earned only in designated channel\n' +
                '• Invites are tracked automatically\n' +
                '• Use the panel for quick access to features'
            );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
