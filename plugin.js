/*jshint esversion: 8 */
import * as rpl from './replacer.js';
import OptionManager from './options.js';

var script = null;

export default class Script extends Plugin {

    constructor(mods) {
        super();
        script = this;
        this.mods = mods;
        this.regex = null; // Initialized after options are loaded
        this.words = null; // Initialized in async prestart
    }

    async prestart() {
    	const fs = require("fs");
    	var dlcEnabled = fs.existsSync("assets/extension/post-game");
        this.words = await fetch("/assets/mods/Word Changer/words.json").then(res=>res.json());
        for (let word in this.words) {
        	let info = this.words[word];
        	if (info.dlc && !dlcEnabled) {
        		delete this.words[word];
        	}
        	if (info.stretchable) {
        		let ind = info.stretchIndex+1;
        		info.regexString = word.substr(0, ind) + "+" + word.substr(ind);
        		info.regex = new RegExp("^" + info.regexString + "$", "i");
        	}
        }
        this.options = new OptionManager(this);
		injectStuff();
    }

    main() {
    	this.options.mainConstructor();
    	for (let word in this.words) {
    		this.words[word].active = this.options.isEnabled(word);
			this.initReplacement(word, this.options.getWord(word), false);
    	}
	    this.updateRegex();
	    this.manuallyReplaceLea();
    }

    updateRegex() {
    	var result = "(?:";
    	for (const word in this.words) {
    		if (!this.words[word].active) {
    			continue;
    		}
    		if (!this.words[word].stretchable) {
    			result += word + "|";
    		} else {
    			result += this.words[word].regexString + "|";
    		}
    	}
    	if (result === "(?:") {
    		this.regex = /(?!)/gi;
    		return;
    	}
    	result = result.substring(0, result.length - 1) + ")";
    	this.regex = new RegExp(result, "gi");
    }

    initReplacement(original, replacement, useGivenIndex) {
    	this.words[original].replacement = replacement;
    	if (this.words[original].stretchable) {
    		this.words[original].replacementParts = rpl.splitReplacement(replacement);
    	}
    	this.options.initOption(original, replacement);
    }

    updateReplacement(original, replacement) {
    	this.words[original].replacement = replacement;
    	if (this.words[original].stretchable) {
    		this.words[original].replacementParts = rpl.splitReplacement(replacement);
    	}
    	this.options.updateOption(original, replacement);
    	if (original === "lea" || original === "hi") {
    		this.manuallyReplaceLea();
    	}
    }

    manuallyReplaceLea() {
		var capitalized = replace("Lea");
		sc.model.leaConfig.character.data.name.en_US = capitalized;
		ig.database.data.lore.lea.title.en_US = capitalized;
		ig.database.data.achievements["landmarks-total-04"].name.en_US = `${capitalized} the Explorer`;
		ig.database.data.areas["cargo-ship"].landmarks.teleporter.description.en_US = `At the Cargo Hold where ${capitalized} started her journey.`;
		ig.lang.labels.sc.gui.menu.stats.keys.yawns = `Total Number of Times ${capitalized} was bored`;
		ig.lang.labels.sc.gui.menu.stats.keys.hiCount = `Total Number of Times ${capitalized} said "${script.words.hi.replacement}"`;
		ig.lang.labels.sc.gui.menu["help-texts"].map.pages[1].content[2] = `Selecting yes closes the menu and teleports ${capitalized} to the location of the landmark`;
		ig.lang.labels.sc.gui.menu["help-texts"].lore.pages[1].content[3] = `I added some extra code here for you, ${capitalized}. Next to the in-game categories I added one for your progress and one for characters.`;
	}

}

function injectStuff() {

	ig.LangLabel.inject({
		init: function(a) {
			if (a.en_US) {
				a.en_US = replace(a.en_US, true);
			}
			this.parent(a);
		}
	});
	ig.EVENT_STEP.SHOW_MSG.inject({
		start: function() {
			var original = this.message;
			replaceLabel(this.message, this.person === "main.lea");
			this.parent();
			this.message = original;
		}
	});
	ig.EVENT_STEP.SHOW_SIDE_MSG.inject({
		start: function() {
			var original = this.message;
			replaceLabel(this.message, this.person === "main.lea");
			this.parent();
			this.message = original;
		}
	});
	ig.EVENT_STEP.SHOW_GET_MSG.inject({
		start: function(a) {
			var original = this.text;
			if (this.msgType === "WORD" && this.text) {
				this.text = replace(this.text);
			}
			this.parent(a);
			this.text = original;
		}
	});
	ig.EVENT_STEP.SHOW_CHOICE.inject({
		start: function() {
			var original = option.label;
			for (let option of this.options) {
				replaceLabel(option.label);
			}
			this.parent();
			option.label = original;
		}
	});
}

function replace(string, leaOnly) {
	// I keep track of which strings I have changed with a null character in the end.
	// I put it in the end to avoid conflict with another mod (uwuifier) that uses this.
	// Another alternative would be to add a "replaced" field to the parent of the replaced
	// string, but I feel this method is much simpler.
	if (!string || string[string.length-1] === '\0') {
		return string;
	}
	var regex, words;
	if (leaOnly) {
		if (!script.words.lea.active) {
			return string;
		}
		regex = /\blea\b/gi;
		words = {lea: script.words.lea};
	} else {
		regex = script.regex;
		words = script.words;
	}
	return string.replace(regex,
			(match) => rpl.replacer(match, words)) + '\0';
}

function replaceLabel(label, isLea) {
	var en_US_exists;
	var message;
	if (label.data && typeof label.data.en_US === "string") {
		en_US_exists = true;
		message = label.data.en_US;
	} else if (typeof label.data === "string") {
		en_US_exists = false;
		message = label.data;
	} else {
		console.log("(Word Changer) Label with unexpected format:");
		console.log(label);
		return;
	}

	var newMessage;
	if (isLea) {
		newMessage = replace(message);
	} else if (script.words.lea.active) {
		newMessage = replace(message, true);
	} else {
		newMessage = message;
	}

	if (en_US_exists) {
		label.data.en_US = newMessage;
	} else {
		label.data = newMessage;
	}
	label.value = ig.LangLabel.getText(label.data);
}
