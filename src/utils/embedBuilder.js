const { EmbedBuilder, Colors } = require('discord.js');

class PremiumEmbed extends EmbedBuilder {
    constructor(data = {}) {
        super(data);
        this.setColor(Colors.Purple);
        this.setTimestamp();
        this.setFooter({ 
            text: 'Saraiki Bot • Made By Subhan', 
            iconURL: 'https://cdn.discordapp.com/attachments/1377209516583813130/1380701780551139358/My_Yt_Profile.jpg?ex=69e76a7c&is=69e618fc&hm=d410fe9f05f9b1082897011ea1500fecd51ea9b50a7baddaa1855e09563f4767&' 
        });
    }

    setSuccess() {
        this.setColor(Colors.Green);
        return this;
    }

    setError() {
        this.setColor(Colors.Red);
        return this;
    }

    setWarning() {
        this.setColor(Colors.Yellow);
        return this;
    }

    setInfo() {
        this.setColor(Colors.Blue);
        return this;
    }

    addField(name, value, inline = false) {
        if (value) {
            super.addFields({ name, value: value.toString(), inline });
        }
        return this;
    }

    setDescription(description) {
        if (description) {
            super.setDescription(description.toString());
        }
        return this;
    }
}

module.exports = { PremiumEmbed };
