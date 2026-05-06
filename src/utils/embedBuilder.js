const { EmbedBuilder, Colors } = require('discord.js');
const { EmojiHelper } = require('./emojiHelper');

class PremiumEmbed extends EmbedBuilder {
    constructor(data = {}) {
        super(data);
        this.setColor(Colors.Purple);
        this.setTimestamp();
        this.setFooter({ 
            text: `Saraiki Bot • Made By Subhan`, 
            iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' 
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
