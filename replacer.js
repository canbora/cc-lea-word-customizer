/*jshint esversion: 8 */

// This function is used to decide which character to stretch in the replacement word.
function lastVowelIndex(string) {
	for (let i = string.length - 1; i >= 0; i--) {
		if ("aeiouy".includes(string.charAt(i))) {
			return i;
		}
	}
	return string.length - 1;
}

export function splitReplacement(string) {
	var i = lastVowelIndex(string);
	return [string.substring(0, i), string.charAt(i), string.substring(i+1)];
}

export function replacer(match, wordList) {
	let result = "error";

	for (const word in wordList) {
		let wordData = wordList[word];
		if (!wordData.active) {
			continue;
		}
		if (!wordData.stretchable && match.toLowerCase() === word) {
			result = wordData.replacement;
			break;
		}
		if (wordData.stretchable && match.match(wordData.regex)) {
			let newWord = wordData.replacementParts;
			let repeatNum = match.length - word.length + 1;
			result = newWord[0] + newWord[1].repeat(repeatNum) + newWord[2];
			break;
		}
	}
	if (match.toUpperCase() === match) { // ALL CAPS
		result = result.toUpperCase();
	} else if (match.charAt(0).toUpperCase() === match.charAt(0)) { // Capitalized
		if (match.toLowerCase() === "lea") {
			// This is a name, so capitalize every word
			result = result.replace(/(\b[a-z])/g, (match, letter) => letter.toUpperCase());
		} else {
			// Otherwise, capitalize only first word
			result = result[0].toUpperCase() + result.substring(1);
		}
	}
	return result;
}