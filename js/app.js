/**
 * MELD Score Calculator v2.0
 * Refactored for maintainability
 */

(function() {
    'use strict';

    // ============================================
    // Configuration
    // ============================================
    const CONFIG = {
        meldTypes: {
            original: { name: 'Original MELD' },
            'meld-na': { name: 'MELD-Na' },
            meld3: { name: 'MELD 3.0' }
        },
        riskLevels: [
            { max: 9, risk: '저위험', mortality: '1.9%', class: 'low' },
            { max: 19, risk: '중간위험', mortality: '6.0%', class: 'moderate' },
            { max: 29, risk: '고위험', mortality: '19.6%', class: 'high' },
            { max: 39, risk: '매우 고위험', mortality: '52.6%', class: 'very-high' },
            { max: Infinity, risk: '최고위험', mortality: '71.3%', class: 'critical' }
        ],
        highlightColor: '#e0f2fe'
    };

    // ============================================
    // Utility Functions
    // ============================================
    const Utils = {
        clamp: (value, min, max) => Math.min(Math.max(value, min), max),
        $(selector) { return document.querySelector(selector); },
        $$(selector) { return document.querySelectorAll(selector); },

        getFormData(formId) {
            const form = this.$(`#${formId}`);
            if (!form) return null;

            const data = {};
            form.querySelectorAll('input').forEach(input => {
                const field = input.dataset.field;
                if (!field) return;

                if (input.type === 'checkbox') {
                    data[field] = input.checked;
                } else if (input.type === 'radio') {
                    if (input.checked) data[field] = input.value;
                } else {
                    data[field] = parseFloat(input.value);
                }
            });
            return data;
        }
    };

    // ============================================
    // MELD Calculation Module
    // ============================================
    const MELDCalculator = {
        calculateOriginal(data) {
            let { bilirubin, inr, creatinine, dialysis } = data;

            bilirubin = Math.max(bilirubin, 1.0);
            inr = Math.max(inr, 1.0);
            creatinine = Math.max(creatinine, 1.0);
            if (dialysis || creatinine > 4.0) creatinine = 4.0;

            const score = (3.78 * Math.log(bilirubin)) +
                          (11.2 * Math.log(inr)) +
                          (9.57 * Math.log(creatinine)) + 6.43;

            return Utils.clamp(Math.round(score), 6, 40);
        },

        calculateMELDNa(data) {
            const meld = this.calculateOriginal(data);
            let { sodium } = data;
            sodium = Utils.clamp(sodium, 125, 137);

            if (meld < 12) return meld;

            const meldNa = meld + 1.32 * (137 - sodium) - (0.033 * meld * (137 - sodium));
            return Utils.clamp(Math.round(meldNa), 6, 40);
        },

        calculateMELD3(data) {
            let { gender, bilirubin, inr, creatinine, sodium, albumin } = data;

            bilirubin = Math.max(bilirubin, 1.0);
            inr = Math.max(inr, 1.0);
            creatinine = Utils.clamp(creatinine, 1.0, 3.0);
            sodium = Utils.clamp(sodium, 125, 137);
            albumin = Utils.clamp(albumin, 1.5, 3.5);

            const femaleCoef = gender === 'female' ? 1.33 : 0;

            const score = femaleCoef +
                          (4.56 * Math.log(bilirubin)) +
                          (0.82 * (137 - sodium)) +
                          (-0.24 * (137 - sodium) * Math.log(bilirubin)) +
                          (9.09 * Math.log(inr)) +
                          (11.14 * Math.log(creatinine)) +
                          (1.85 * (3.5 - albumin)) +
                          (-1.83 * (3.5 - albumin) * Math.log(creatinine)) + 6;

            return Utils.clamp(Math.round(score), 6, 40);
        },

        calculate(type, data) {
            switch (type) {
                case 'original': return this.calculateOriginal(data);
                case 'meld-na': return this.calculateMELDNa(data);
                case 'meld3': return this.calculateMELD3(data);
                default: throw new Error(`Unknown MELD type: ${type}`);
            }
        },

        getRiskAssessment(score) {
            return CONFIG.riskLevels.find(level => score <= level.max);
        }
    };

    // ============================================
    // UI Module
    // ============================================
    const UI = {
        elements: {},

        init() {
            this.cacheElements();
            this.bindEvents();
        },

        cacheElements() {
            this.elements = {
                tabButtons: Utils.$$('.tab-btn'),
                tabContents: Utils.$$('.tab-content'),
                forms: Utils.$$('.meld-form'),
                result: Utils.$('#result'),
                resultType: Utils.$('#result-type'),
                resultScore: Utils.$('#result-score'),
                resultRisk: Utils.$('#result-risk'),
                resultMortality: Utils.$('#result-mortality'),
                guideRows: Utils.$$('.guide-table tbody tr')
            };
        },

        bindEvents() {
            this.elements.tabButtons.forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });

            this.elements.forms.forEach(form => {
                form.addEventListener('submit', (e) => this.handleSubmit(e));
                form.addEventListener('reset', () => this.hideResult());
            });
        },

        switchTab(tabId) {
            this.elements.tabButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabId);
            });
            this.elements.tabContents.forEach(content => {
                content.classList.toggle('active', content.id === tabId);
            });
            this.hideResult();
        },

        handleSubmit(e) {
            e.preventDefault();
            const form = e.target;
            const meldType = form.dataset.meldType;
            const data = Utils.getFormData(form.id);

            if (meldType === 'meld3' && !data.gender) {
                alert('성별을 선택해주세요.');
                return;
            }

            const score = MELDCalculator.calculate(meldType, data);
            this.displayResult(CONFIG.meldTypes[meldType].name, score);
        },

        displayResult(type, score) {
            const assessment = MELDCalculator.getRiskAssessment(score);

            this.elements.resultType.textContent = type;
            this.elements.resultScore.textContent = score;
            this.elements.resultRisk.textContent = assessment.risk;
            this.elements.resultMortality.textContent = assessment.mortality;

            this.elements.result.classList.remove('hidden');
            this.elements.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.highlightGuideRow(assessment.class);
        },

        hideResult() {
            this.elements.result.classList.add('hidden');
            this.clearHighlight();
        },

        highlightGuideRow(riskClass) {
            this.clearHighlight();
            const row = Utils.$(`.risk-${riskClass}`);
            if (row) row.style.backgroundColor = CONFIG.highlightColor;
        },

        clearHighlight() {
            this.elements.guideRows.forEach(row => row.style.backgroundColor = '');
        }
    };

    // ============================================
    // PWA Module
    // ============================================
    const PWA = {
        deferredPrompt: null,
        elements: {},

        init() {
            this.cacheElements();
            this.bindEvents();
            this.registerServiceWorker();
        },

        cacheElements() {
            this.elements = {
                prompt: Utils.$('#install-prompt'),
                installBtn: Utils.$('#install-btn'),
                dismissBtn: Utils.$('#install-dismiss')
            };
        },

        bindEvents() {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                setTimeout(() => this.showPrompt(), 3000);
            });

            window.addEventListener('appinstalled', () => this.hidePrompt());
            this.elements.installBtn?.addEventListener('click', () => this.install());
            this.elements.dismissBtn?.addEventListener('click', () => this.dismiss());
        },

        showPrompt() {
            if (this.deferredPrompt && this.elements.prompt) {
                this.elements.prompt.classList.remove('hidden');
            }
        },

        hidePrompt() {
            this.elements.prompt?.classList.add('hidden');
            this.deferredPrompt = null;
        },

        async install() {
            if (!this.deferredPrompt) return;
            this.deferredPrompt.prompt();
            await this.deferredPrompt.userChoice;
            this.hidePrompt();
        },

        dismiss() {
            this.hidePrompt();
        },

        registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
            }
        }
    };

    // ============================================
    // Initialize
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        UI.init();
        PWA.init();
    });

})();
