/*jshint esversion: 8 */
export default class OptionManager {

	constructor(script) {
		this.script = script;
		var maxId = -1;
		for (let cat in sc.OPTION_CATEGORY) {
			let id = sc.OPTION_CATEGORY[cat];
			maxId = (id > maxId) ? id : maxId;
		}
		sc.OPTION_CATEGORY.WORD_CHANGER = maxId + 1;

		for (let word in script.words) {
	    	sc.OPTIONS_DEFINITION['word-changer-info-' + word] = {
		        cat: sc.OPTION_CATEGORY.WORD_CHANGER,
		        type: "INFO",
		        data: "options.word-changer-info-" + word + ".description"
		    };
			sc.OPTIONS_DEFINITION['word-changer-toggle-' + word] = {
				cat: sc.OPTION_CATEGORY.WORD_CHANGER,
				type: 'CHECKBOX',
				init: false,
				restart: false,
	    	};
		}
		sc.fontsystem.font.setMapping({"word-changer": [0, 58]});
	}

	mainConstructor() {
		for (let word in this.words) {
    		if (!this.options.getWord(word)) {
    			this.options.setWord(word, word);
    		}
    	}
		ig.lang.labels.sc.gui.menu.option["word-changer"] = "Words";
		var script = this.script;
		var options = this;
    	sc.Model.addObserver(sc.options, {
    		modelChanged: function() {
    			var words = script.words;
    			for (let word in words) {
    				if (options.isEnabled(word) && !words[word].active) {
    					words[word].active = true;
    					if (sc.menu.directMenu === 8) { // if in menu
    						options.getReplacement(word, words[word].replacement);
    						script.updateRegex();
    					}
    				} else if (!options.isEnabled(word) && words[word].active) {
    					words[word].active = false;
    					script.updateRegex();
    				}
    			}
    		}
    	});
	}

	getWord(word) {
		return sc.options.values["word-changer-info-"+word];
	}

	setWord(original, replacement) {
		sc.options.values["word-changer-info-"+original] = replacement;
	}

	isEnabled(word) {
		return sc.options.values["word-changer-toggle-"+word];
	}

	initOption(original, replacement) {
		let toggletext = 'Replace "' + original + '"';
    	let infotext = 'Current replacement for "' + original + '": ' + replacement;

    	if (original != "lea") {
    		ig.lang.labels.sc.gui.options['word-changer-toggle-' + original] = {
    			name: toggletext,
    			description: "Tick to replace this word with another."
    		};

    		ig.lang.labels.sc.gui.options['word-changer-info-' + original] = {
    			description: infotext
    		};
    	} else {
    		ig.lang.labels.sc.gui.options['word-changer-toggle-lea'] = {
    			name: "Replace character name",
    			description: "Tick to change the main character's name."
    		};

    		ig.lang.labels.sc.gui.options['word-changer-info-lea'] = {
    			description: "Current name: " + replacement + ". This is used by the character as well as others."
    		};

    	}
	}

	updateOption(original, replacement) {
		var infotext;
    	if (original != "lea") {
    		infotext = 'Current replacement for "' + original + '": ' + replacement;
        } else {
        	infotext = "Current name: " + replacement + ". This is used by the character as well as others.";
        }
        ig.lang.labels.sc.gui.options['word-changer-info-' + original].description = infotext;

		var options = sc.menu.guiReference.submenus.options.listBox.rows;
    	for (let ind in options) {
    		// The code below relies on the info box being directly above the toggle option.
    		// This has been the only way I've found to find the correct info box.
    		if (options[ind].optionName === "word-changer-toggle-" + original) {
                options[ind-1].text.setText(infotext);
                break;
    		}
    	}

    	this.setWord(original, replacement);
	}

	getReplacement(original, prevReplacement) {
		if(window.ig && window.ig.system){
			// I've chosen the gamecodeMessage overlay because it's in the format I want
		    var overlay = ig.dom.html('<div class="gameOverlayBox gamecodeMessage" ><h3>Enter replacement for "' + original + '"</h3></div>');
		    var form = ig.dom.html('<form><input type="text" name="replacement" value="' + prevReplacement + '" /><input type="submit" name="send" value="Submit" /><form>');
		    overlay.append(form);
		    var script = this.script;
		    form.submit(function(){
		        let newReplacement = form[0].replacement.value.toLowerCase() || prevReplacement;
		        script.updateReplacement(original, newReplacement);
		        ig.system.regainFocus();
		        return false;
		    });

		    $(document.body).append(overlay);
		    window.setTimeout(function(){
		        overlay.addClass("shown");
		    }, 20);
		    ig.system.setFocusLost();

		    var close = function(){
		        overlay.remove();
		    };
		    ig.system.addFocusListener(close);
		    form.find("input[type=text]").focus();
		}
	}

}