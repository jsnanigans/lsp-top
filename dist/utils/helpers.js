"use strict";
// Utility functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.unusedFunction = unusedFunction;
exports.formatDate = formatDate;
exports.capitalize = capitalize;
exports.debounce = debounce;
function unusedFunction() {
    console.log('This function is imported but never used');
}
function formatDate(date) {
    return date.toISOString().split('T')[0];
}
function capitalize(str) {
    if (!str)
        return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
function debounce(func, wait) {
    let timeout;
    return function debounced(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
