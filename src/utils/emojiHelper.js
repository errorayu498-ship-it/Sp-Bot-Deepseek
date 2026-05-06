const emojis = require('../config/emojis');

class EmojiHelper {
    /**
     * Get emoji from config
     * @param {string} path - Dot notation path (e.g., 'giveaway.create')
     * @returns {string} Emoji
     */
    static get(path) {
        const keys = path.split('.');
        let value = emojis;
        
        for (const key of keys) {
            if (value && value[key] !== undefined) {
                value = value[key];
            } else {
                return '❓'; // Default emoji if not found
            }
        }
        
        return value;
    }
    
    /**
     * Get emoji with space (for text formatting)
     * @param {string} path - Dot notation path
     * @returns {string} Emoji with space
     */
    static getWithSpace(path) {
        return this.get(path) + ' ';
    }
    
    /**
     * Get multiple emojis
     * @param {...string} paths - Multiple paths
     * @returns {string} Combined emojis
     */
    static getMultiple(...paths) {
        return paths.map(p => this.get(p)).join(' ');
    }
}

module.exports = { EmojiHelper };
