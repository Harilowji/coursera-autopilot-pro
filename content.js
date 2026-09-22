// ============================================================
// Coursera Autopilot Pro - Content Script v2.2
// All-in-One: Skip Videos, Readings, Progress Audit, FAP Cert Extractor,
// Auto Peer Review, Auto Discussion & Multi-Provider AI Quiz Solver
// ============================================================

const BASE_URL = "/api/";

// Helper to safely send runtime messages without throwing unhandled promise rejections
function safeSendMessage(payload) {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            const p = chrome.runtime.sendMessage(payload);
            if (p && typeof p.catch === 'function') {
                p.catch(() => {});
            }
        }
    } catch (_) {}
}

// Helper to log to popup & background
function log(msg) {
    console.log("[AutopilotPro] " + msg);
    safeSendMessage({ action: "LOG", message: msg });
}

// Cookie helper
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Randomizer helper
function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Predefined diverse academic templates (Anti-plagiarism / anti-bot detection)
const PEER_SUBMISSION_TEMPLATES = [
    {
        title: "Course Project Final Submission - Practical Application Report",
        body: "In this assignment, I have focused on applying the core concepts and methodologies discussed across the lecture modules. The implementation strictly adheres to the given instructions and best practices. All calculations, steps, and final findings have been thoroughly verified to ensure academic accuracy and comprehensive analysis."
    },
    {
        title: "Comprehensive Module Assignment & Case Study Analysis",
        body: "This submission represents an end-to-end implementation of the requirements outlined in the prompt. By integrating theoretical foundations with practical examples from the course, I structured the solution systematically. Each criterion in the evaluation rubric has been directly addressed."
    },
    {
        title: "Applied Project Deliverable - Methods & Results Summary",
        body: "For this peer-graded assignment, I developed a structured solution aligned with the course objectives. Key principles from the readings and lectures were utilized to ensure rigorous methodology. The results achieved match the expected outcomes and demonstrate a deep grasp of the subject."
    },
    {
        title: "Peer Assessment Submission - In-Depth Analysis and Implementation",
        body: "Here is my completed work for this module. The task was approached methodically by breaking down objectives into concise sections, verifying that all technical and analytical criteria were satisfied. The documentation provided reflects careful consideration of the course guidelines."
    },
    {
        title: "Coursework Milestone Project - Core Findings and Evaluation",
        body: "This project deliverable synthesizes the major insights gained throughout the course. I have addressed every prompt requirement with clear reasoning and structured formatting. The methodology follows the evaluation rubric closely to ensure high quality and clarity."
    }
];

const PEER_FEEDBACK_TEMPLATES = [
    "Excellent work! The submission is thoroughly researched, well-structured, and fulfills all the rubric requirements with great clarity.",
    "Very well-done! The methodology is sound, explanations are clear, and all required criteria have been addressed accurately.",
    "Impressive effort on this assignment! Everything is presented in a neat, professional manner and meets the highest standards of the rubric.",
    "Great submission overall. The core concepts are applied correctly, and the documentation is easy to follow from start to finish.",
    "Outstanding project! Clear attention to detail and rigorous execution throughout. Well deserving of full marks.",
    "Thorough and well-thought-out work. All sections required by the guidelines are complete and clearly reasoned. Great job!"
];

const DISCUSSION_TEMPLATES = [
    "Thank you for sharing these valuable insights! I found the practical examples in this module particularly engaging and directly applicable.",
    "Great discussion topic! Integrating these principles into real-world scenarios certainly provides a clearer perspective on the problem.",
    "This was a very informative session. The breakdown of core concepts helped solidify my understanding of the subject matter.",
    "I appreciate the diverse viewpoints shared here. The material covered in this unit definitely highlights several critical considerations for implementation.",
    "Very helpful discussion prompt. Looking forward to exploring these techniques further in the upcoming modules!"
];

// Clipboard helper
async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    }
}

// JSON extraction helper
function extractJsonFromText(rawText) {
    if (!rawText) return null;
    let clean = rawText.trim();
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(clean);
}

// ============================================================
// QUIZ DOM PARSER & HELPER FUNCTIONS
// ============================================================

function extractQuizQuestions() {
    const questions = [];
    
    // Strategy 1: Find dedicated question block containers on Coursera
    let questionBlocks = Array.from(document.querySelectorAll(
        'div[data-testid^="part-Submission_Form_"], div[data-testid*="question-container"], div[data-testid*="question-block"], div[data-testid*="QuestionBlock"], .rc-FormPartsQuestion, .rc-QuizQuestion, fieldset[class*="Question"], fieldset'
    ));

    // Filter out parent containers that contain nested question containers (keep leaf question blocks)
    questionBlocks = questionBlocks.filter(block => {
        return !questionBlocks.some(other => other !== block && block.contains(other));
    });

    // Strategy 2: If no structured blocks or only 1 big block containing all inputs (e.g. form wrapper)
    if (questionBlocks.length <= 1) {
        const allInputs = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"], select, textarea, input[type="text"], input[type="number"]'));
        
        // Group by input.name (for radios) or by common nearest container
        const groups = new Map();
        allInputs.forEach((inp, idx) => {
            if (inp.id && inp.id.includes('agreement')) return;
            if (inp.name && inp.name.includes('honor')) return;
            if (inp.type === 'hidden') return;

            let groupKey;
            if (inp.type === 'radio' && inp.name) {
                groupKey = `radio_${inp.name}`;
            } else {
                const container = inp.closest('div[role="group"], div[data-testid], fieldset, li, tr, div[class*="Part"]') || inp.parentElement?.parentElement || inp.parentElement;
                groupKey = container || `input_${idx}`;
            }

            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey).push(inp);
        });

        // Convert groups into synthesized question objects
        let qIdx = 0;
        for (const [key, inputs] of groups.entries()) {
            const firstInp = inputs[0];
            const container = firstInp.closest('div[role="group"], div[data-testid], fieldset, div[class*="Question"]') || firstInp.parentElement?.parentElement || firstInp.parentElement;
            
            let qType = "single";
            if (firstInp.type === 'checkbox') qType = "multiple";
            else if (firstInp.tagName === 'SELECT') qType = "dropdown";
            else if (firstInp.tagName === 'TEXTAREA' || firstInp.type === 'text' || firstInp.type === 'number') qType = "text";

            // Extract question text
            let qText = "";
            if (container) {
                const textEl = container.querySelector('.rc-CML, [data-testid="cml-viewer"], legend, .rc-FormPart__question-text, .rc-QuestionText, h3, h4');
                if (textEl) qText = textEl.innerText.trim();
                else {
                    const ancestor = container.parentElement;
                    const ancestorTextEl = ancestor ? ancestor.querySelector('.rc-CML, legend, h3, h4, [data-testid*="question"]') : null;
                    if (ancestorTextEl) qText = ancestorTextEl.innerText.trim();
                }
            }
            if (!qText) qText = `Câu hỏi ${qIdx + 1}`;
            qText = qText.replace(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*points?/gi, '').replace(/\d+\s*điểm/gi, '').trim();

            const options = [];
            if (qType === "dropdown") {
                Array.from(firstInp.options).forEach((opt, oIndex) => {
                    if (opt.value && opt.text.trim()) {
                        options.push({ index: oIndex, text: opt.text.trim(), value: opt.value, element: firstInp, clickTarget: firstInp });
                    }
                });
            } else if (qType !== "text") {
                inputs.forEach((inp, oIndex) => {
                    const parentLabel = inp.closest('label');
                    const parentOpt = inp.closest('.rc-Option, [role="radio"], [role="checkbox"], div[class*="Option"]') || parentLabel || inp.parentElement;
                    let optText = parentLabel ? (parentLabel.innerText || "") : (parentOpt ? parentOpt.innerText : (inp.value || `Lựa chọn ${oIndex + 1}`));
                    optText = optText.replace(/^[a-zA-Z0-9][\.\)\-]\s*/, '').trim();
                    options.push({
                        index: oIndex,
                        text: optText || `Lựa chọn ${oIndex + 1}`,
                        element: inp,
                        clickTarget: parentOpt || inp
                    });
                });
            }

            questions.push({
                id: qIdx,
                displayNumber: qIdx + 1,
                text: qText,
                type: qType,
                options: options,
                textElement: qType === "text" ? firstInp : null,
                textElements: qType === "text" ? inputs : []
            });
            qIdx++;
        }

        if (questions.length > 0) return questions;
    }

    // Process structured questionBlocks
    questionBlocks.forEach((qEl, qIndex) => {
        // Query inputs safely: native inputs first to prevent duplicate options from role="radio" wrappers
        let radioInputs = Array.from(qEl.querySelectorAll('input[type="radio"]'));
        if (radioInputs.length === 0) {
            radioInputs = Array.from(qEl.querySelectorAll('[role="radio"]'));
        }
        let checkInputs = Array.from(qEl.querySelectorAll('input[type="checkbox"]'));
        if (checkInputs.length === 0) {
            checkInputs = Array.from(qEl.querySelectorAll('[role="checkbox"]'));
        }
        const selectInputs = Array.from(qEl.querySelectorAll('select'));
        const textInputs = Array.from(qEl.querySelectorAll('textarea, input[type="text"]'));

        let qType = "single";
        let inputElements = radioInputs;
        if (checkInputs.length > 0) {
            qType = "multiple";
            inputElements = checkInputs;
        } else if (selectInputs.length > 0) {
            qType = "dropdown";
            inputElements = selectInputs;
        } else if (textInputs.length > 0 && radioInputs.length === 0) {
            qType = "text";
            inputElements = textInputs;
        }

        if (inputElements.length === 0 && selectInputs.length === 0) return;

        // Extract full question text
        let qText = "";
        const contentSelectors = [
            "div.rc-CML",
            "div[data-testid='cml-viewer']",
            "div[data-testid='legend']",
            "legend",
            ".rc-FormPart__question-text",
            "div.rc-QuestionBody",
            "[data-e2e='question-text']",
            ".rc-QuestionText",
            "h3", "h4"
        ];

        for (const sel of contentSelectors) {
            const el = qEl.querySelector(sel);
            if (el && el.innerText.trim().length > 5) {
                qText = el.innerText.trim();
                break;
            }
        }

        if (!qText) {
            let rawText = qEl.innerText || "";
            rawText = rawText.replace(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*points?/gi, '');
            rawText = rawText.replace(/\d+(?:\.\d+)?\s*points?/gi, '');
            rawText = rawText.replace(/\d+\s*điểm/gi, '');
            rawText = rawText.replace(/^Question\s*\d+[\s\.\:]*/i, '');
            qText = rawText.split('\n').filter(line => line.trim().length > 0)[0] || `Câu hỏi ${qIndex + 1}`;
        }

        qText = qText.replace(/^Question\s*\d+[\s\.\:]*/i, '').trim();

        // Extract options
        const options = [];
        if (qType === "dropdown") {
            const selEl = selectInputs[0];
            Array.from(selEl.options).forEach((opt, oIndex) => {
                if (opt.value && opt.text.trim()) {
                    options.push({
                        index: oIndex,
                        text: opt.text.trim(),
                        value: opt.value,
                        element: selEl,
                        clickTarget: selEl
                    });
                }
            });
        } else if (qType !== "text") {
            inputElements.forEach((inp, oIndex) => {
                const parentLabel = inp.closest('label');
                const parentOpt = inp.closest('.rc-Option, [role="radio"], [role="checkbox"], div[class*="Option"]') || parentLabel || inp.parentElement;
                let optText = parentLabel ? (parentLabel.innerText || "") : (parentOpt ? parentOpt.innerText : (inp.value || `Lựa chọn ${oIndex + 1}`));
                optText = optText.replace(/^[a-zA-Z0-9][\.\)\-]\s*/, '').trim();
                options.push({
                    index: oIndex,
                    text: optText || `Lựa chọn ${oIndex + 1}`,
                    element: inp,
                    clickTarget: parentOpt || inp
                });
            });
        }

        questions.push({
            id: qIndex,
            displayNumber: qIndex + 1,
            text: qText,
            type: qType,
            options: options,
            textElement: qType === "text" ? textInputs[0] : null,
            textElements: qType === "text" ? textInputs : []
        });
    });

    return questions;
}

function generateQuizPrompt(questions) {
    let prompt = "You are an expert academic assistant solving a Coursera quiz with 100% accuracy.\n";
    prompt += "Analyze each question and its choices carefully. Return ONLY a single, valid JSON object in this exact format:\n";
    prompt += "{\n  \"answers\": {\n";
    prompt += "    \"1\": [0],\n";
    prompt += "    \"2\": [1, 2],\n";
    prompt += "    \"3\": \"my text answer\"\n";
    prompt += "  }\n}\n\n";
    prompt += "RULES FOR QUIZ SOLVING:\n";
    prompt += "1. Keys MUST be question numbers (\"1\", \"2\", \"3\", ...).\n";
    prompt += "2. For 'Single Choice' or 'Dropdown': return an array with exactly one 0-based option index, e.g. [0] or [2].\n";
    prompt += "3. For 'Multiple Choice' (Select all that apply): return an array of all correct 0-based option indices, e.g. [0, 2].\n";
    prompt += "4. For 'Fill in the blank' / 'Text' / 'Numeric': return the exact string or number answer (e.g. \"42\" or \"supervised learning\").\n";
    prompt += "5. Return ONLY raw JSON without markdown fences, explanation, or notes.\n\n";
    prompt += "=== EXAM QUESTIONS ===\n\n";

    questions.forEach(q => {
        let typeDesc = "Single Choice - Select one";
        if (q.type === 'multiple') typeDesc = "Multiple Choice - Select all that apply";
        else if (q.type === 'text') typeDesc = "Fill in the blank / Direct Answer";
        else if (q.type === 'dropdown') typeDesc = "Dropdown Selection";

        prompt += `--- Question ${q.displayNumber} (${typeDesc}) ---\n`;
        prompt += `${q.text}\n`;
        if (q.options.length > 0) {
            prompt += "Options:\n";
            q.options.forEach(opt => {
                const letter = String.fromCharCode(65 + opt.index);
                prompt += `  [${opt.index}] (${letter}): ${opt.text}\n`;
            });
        }
        prompt += "\n";
    });

    return prompt;
}

// Helper to set React text input or textarea value reliably
function setReactInputValue(inputEl, value) {
    if (!inputEl) return;
    try {
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEl.focus();

        const proto = (inputEl.tagName === 'TEXTAREA')
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        // Reset React internal _valueTracker so synthetic event system detects change
        const tracker = inputEl._valueTracker;
        if (tracker) {
            tracker.setValue('');
        }

        if (valueSetter) {
            valueSetter.call(inputEl, String(value));
        } else {
            inputEl.value = String(value);
        }

        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        // Fallback for rich/custom inputs
        try {
            document.execCommand('insertText', false, String(value));
        } catch (_) {}

        // Visual indicator (green border glow)
        inputEl.style.transition = 'all 0.3s ease';
        inputEl.style.outline = '2px solid #10b981';
        inputEl.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
        inputEl.style.borderRadius = '4px';
    } catch (e) {
        console.warn("[AutopilotPro] setReactInputValue error:", e);
    }
}

// Helper to simulate natural user click and update React radio/checkbox state
function triggerReactInputClick(inputEl, wrapperEl) {
    if (!inputEl && !wrapperEl) return;

    const targetToClick = wrapperEl || inputEl;
    const realInput = (inputEl && (inputEl.tagName === 'INPUT' || inputEl.tagName === 'SELECT'))
        ? inputEl
        : (wrapperEl ? wrapperEl.querySelector('input') : null);

    // 1. Scroll into view
    try {
        (wrapperEl || inputEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}

    // 2. Focus
    try {
        if (realInput) realInput.focus();
        else targetToClick.focus();
    } catch (_) {}

    // 3. Dispatch natural pointer & click events
    try {
        targetToClick.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, isPrimary: true }));
        targetToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 }));
        targetToClick.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, isPrimary: true }));
        targetToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 1 }));
        targetToClick.click();
    } catch (_) {}

    // 4. If the input is a native radio or checkbox, verify and enforce checked state
    if (realInput && (realInput.type === 'radio' || realInput.type === 'checkbox')) {
        if (!realInput.checked) {
            try {
                // React internal valueTracker bypass
                const tracker = realInput._valueTracker;
                if (tracker) {
                    tracker.setValue(!realInput.checked);
                }
                const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');
                if (descriptor && descriptor.set) {
                    descriptor.set.call(realInput, true);
                } else {
                    realInput.checked = true;
                }
                realInput.dispatchEvent(new Event('input', { bubbles: true }));
                realInput.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (_) {
                realInput.checked = true;
            }
        }
    } else if (targetToClick.hasAttribute('aria-checked')) {
        targetToClick.setAttribute('aria-checked', 'true');
    }

    // 5. Visual indicator (Emerald glow)
    try {
        const visualTarget = wrapperEl || inputEl;
        visualTarget.style.transition = 'all 0.3s ease';
        visualTarget.style.outline = '2px solid #10b981';
        visualTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.18)';
        visualTarget.style.borderRadius = '6px';
    } catch (_) {}
}

// Helper to extract the answer for a specific question from whatever JSON format AI produced
function getAnswerForQuestion(answersMap, q) {
    if (!answersMap) return undefined;

    // If answersMap is an Array
    if (Array.isArray(answersMap)) {
        if (answersMap[q.id] !== undefined) return answersMap[q.id];
        if (answersMap[q.displayNumber - 1] !== undefined) return answersMap[q.displayNumber - 1];
        const item = answersMap.find(it => it && (it.question == q.displayNumber || it.id == q.displayNumber || it.question == q.id));
        if (item) return item.answer !== undefined ? item.answer : (item.answers || item.selected || item.value);
    }

    // Direct key matches
    const candidateKeys = [
        String(q.displayNumber),
        String(q.id),
        `Question ${q.displayNumber}`,
        `question ${q.displayNumber}`,
        `Question_${q.displayNumber}`,
        `question_${q.displayNumber}`,
        `Q${q.displayNumber}`,
        `q${q.displayNumber}`
    ];

    for (const k of candidateKeys) {
        if (answersMap[k] !== undefined) return answersMap[k];
    }

    // Fuzzy case-insensitive key search
    for (const [k, v] of Object.entries(answersMap)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK === String(q.displayNumber) || cleanK === `question${q.displayNumber}` || cleanK === `q${q.displayNumber}`) {
            return v;
        }
    }

    return undefined;
}

// Helper to convert any raw answer (integer, letter "A", array, text string) into valid option indices
function resolveOptionIndices(rawAnswer, options) {
    if (rawAnswer === undefined || rawAnswer === null || !options || options.length === 0) return [];
    const items = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
    const resolved = new Set();

    for (let item of items) {
        if (item === undefined || item === null) continue;

        if (typeof item === 'object') {
            if (item.index !== undefined) item = item.index;
            else if (item.answer !== undefined) item = item.answer;
            else if (item.value !== undefined) item = item.value;
        }

        // 1. Direct number check
        const num = Number(item);
        if (!isNaN(num) && Number.isInteger(num)) {
            if (options.some(o => o.index === num)) {
                resolved.add(num);
                continue;
            }
        }

        // 2. Letter check (A, B, C, D, E, F...)
        if (typeof item === 'string') {
            const trimmed = item.trim().toUpperCase();
            if (/^[A-H]$/.test(trimmed)) {
                const letterIndex = trimmed.charCodeAt(0) - 65;
                if (options.some(o => o.index === letterIndex)) {
                    resolved.add(letterIndex);
                    continue;
                }
            }
        }

        // 3. Text fuzzy match against option text
        if (typeof item === 'string' && item.trim().length > 0) {
            const itemLower = item.trim().toLowerCase();
            const matched = options.find(o => {
                const optLower = (o.text || '').toLowerCase();
                return optLower === itemLower || optLower.includes(itemLower) || itemLower.includes(optLower);
            });
            if (matched) {
                resolved.add(matched.index);
                continue;
            }
        }
    }

    return Array.from(resolved);
}

async function applyQuizAnswers(parsedAnswers, questions) {
    let answersMap = parsedAnswers.answers || parsedAnswers;
    if (typeof answersMap !== 'object' || answersMap === null) {
        answersMap = parsedAnswers;
    }
    let filledCount = 0;

    for (const q of questions) {
        const rawAnswer = getAnswerForQuestion(answersMap, q);
        if (rawAnswer === undefined || rawAnswer === null) {
            console.warn(`[AutopilotPro] Không tìm thấy đáp án cho câu ${q.displayNumber}`);
            continue;
        }

        // Case 1: Dropdown
        if (q.type === "dropdown" && q.options.length > 0) {
            const resolved = resolveOptionIndices(rawAnswer, q.options);
            const targetIdx = resolved.length > 0 ? resolved[0] : 0;
            const selEl = q.options[0].element;
            if (selEl && targetIdx >= 0 && targetIdx < selEl.options.length) {
                selEl.selectedIndex = targetIdx;
                selEl.dispatchEvent(new Event('input', { bubbles: true }));
                selEl.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
                const chosenText = selEl.options[targetIdx]?.text || targetIdx;
                log(`✅ [Câu ${q.displayNumber}] Đã chọn menu: "${chosenText}"`);
            }

        // Case 2: Fill-in-the-blank / Text / Numeric input
        } else if (q.type === "text" && (q.textElement || (q.textElements && q.textElements.length > 0))) {
            let answerText = "";
            if (typeof rawAnswer === 'string' || typeof rawAnswer === 'number') {
                answerText = String(rawAnswer).trim();
            } else if (Array.isArray(rawAnswer) && rawAnswer.length > 0) {
                answerText = String(rawAnswer[0]).trim();
            } else if (typeof rawAnswer === 'object') {
                answerText = String(rawAnswer.text || rawAnswer.answer || rawAnswer.value || '').trim();
            }

            const targetInput = q.textElement || q.textElements[0];
            if (targetInput && answerText) {
                setReactInputValue(targetInput, answerText);
                filledCount++;
                log(`✏️ [Câu ${q.displayNumber}] Đã điền vào ô: "${answerText.length > 30 ? answerText.substring(0, 27) + '...' : answerText}"`);
            }

        // Case 3: Radio button (Single choice) or Checkbox (Multiple choice)
        } else if (q.options.length > 0) {
            const resolvedIndices = resolveOptionIndices(rawAnswer, q.options);
            if (resolvedIndices.length === 0) {
                console.warn(`[AutopilotPro] Không khớp được lựa chọn nào cho câu ${q.displayNumber}:`, rawAnswer);
                continue;
            }

            const chosenLabels = [];
            for (const optIdx of resolvedIndices) {
                const opt = q.options.find(o => o.index === optIdx);
                if (opt) {
                    try {
                        triggerReactInputClick(opt.element, opt.clickTarget);
                        filledCount++;
                        const letter = String.fromCharCode(65 + opt.index);
                        const shortText = opt.text.length > 30 ? opt.text.substring(0, 28) + '...' : opt.text;
                        chosenLabels.push(`[${letter}] ${shortText}`);
                    } catch (e) {
                        console.warn("Click option error:", e);
                    }
                }
            }

            if (chosenLabels.length > 0) {
                log(`✅ [Câu ${q.displayNumber}] Đã chọn: ${chosenLabels.join(' | ')}`);
            }
        }

        // Human-like delay between questions (150ms - 300ms)
        await new Promise(r => setTimeout(r, 150 + Math.floor(Math.random() * 150)));
    }

    // Auto-check Coursera Honor Code agreement checkbox if present
    try {
        const honorBoxes = document.querySelectorAll(
            '#agreement-checkbox-base, input[data-testid="honor-code-checkbox"], input[type="checkbox"][name*="honor"], input[type="checkbox"][name*="agreement"]'
        );
        honorBoxes.forEach(box => {
            if (!box.checked) {
                triggerReactInputClick(box, box.parentElement);
                log("🤝 Đã tự động tích cam kết danh dự (Honor Code Agreement).");
            }
        });
    } catch (_) {}

    // Smooth scroll down to submit button area
    try {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (_) {}

    return filledCount;
}

// ============================================================
// MAIN SKIPPER CLASS
// ============================================================

class SkiperaJS {
    constructor(mode = 'safe') {
        this.userId = null;
        this.courseId = null;
        this.slug = null;
        this.csrfToken = getCookie("CSRF3-Token") || getCookie("csrf3-token");
        this.isStopped = false;
        this.mode = mode; // 'safe' or 'turbo'
        this.completedIds = new Set();

        if (!this.csrfToken) {
            log("⚠️ CẢNH BÁO: Không tìm thấy cookie CSRF3-Token! Hãy chắc chắn bạn đã đăng nhập.");
        }
    }

    stop() {
        this.isStopped = true;
        log("🛑 Đang dừng tiến trình...");
    }

    getHeaders() {
        return {
            'x-coursera-application': 'ondemand',
            'x-coursera-version': '3bfd497de04ae0fef167b747fd85a6fbc8fb55df',
            'x-requested-with': 'XMLHttpRequest',
            'x-csrf3-token': this.csrfToken
        };
    }

    async getUserId() {
        try {
            const response = await fetch(BASE_URL + "adminUserPermissions.v1?q=my", {
                headers: this.getHeaders()
            });
            if (response.ok) {
                const json = await response.json();
                if (json.elements && json.elements[0] && json.elements[0].id) {
                    this.userId = json.elements[0].id;
                    return true;
                }
            }
        } catch (_) {}

        // Fallback 1: externalBasicProfiles.v1?q=me
        try {
            const response2 = await fetch(BASE_URL + "externalBasicProfiles.v1?q=me", {
                headers: this.getHeaders()
            });
            if (response2.ok) {
                const json2 = await response2.json();
                if (json2.elements && json2.elements[0] && json2.elements[0].id) {
                    this.userId = json2.elements[0].id;
                    return true;
                }
            }
        } catch (_) {}

        // Fallback 2: cookie _coursera_user_id
        const cookieId = getCookie("_coursera_user_id") || getCookie("coursera_user_id");
        if (cookieId) {
            this.userId = cookieId;
            return true;
        }

        return false;
    }

    async getCompletedItemIds() {
        try {
            const url = `${BASE_URL}onDemandCourseProgresses.v1/${this.userId}~${this.courseId}`;
            const res = await fetch(url, { headers: this.getHeaders() });
            if (res.ok) {
                const json = await res.json();
                if (json.elements && json.elements[0] && json.elements[0].completedItemIds) {
                    return new Set(json.elements[0].completedItemIds);
                }
            }
        } catch (e) {
            console.warn("Could not fetch completedItemIds:", e);
        }
        return new Set();
    }

    async getCourse(slug) {
        this.slug = slug;
        const params = new URLSearchParams({
            "q": "slug",
            "slug": slug,
            "includes": "modules,lessons,items",
            "fields": "moduleIds,onDemandCourseMaterialModules.v1(name,slug,lessonIds),onDemandCourseMaterialLessons.v1(name,slug,elementIds),onDemandCourseMaterialItems.v2(name,slug,timeCommitment,contentSummary)",
            "showLockedItems": "true"
        });

        log("🔍 Đang tải danh sách bài học qua Coursera API...");
        try {
            const response = await fetch(BASE_URL + "onDemandCourseMaterials.v2/?" + params.toString(), {
                headers: this.getHeaders()
            });
            const json = await response.json();
            if (!json.elements || json.elements.length === 0) {
                log("❌ Không tìm thấy thông tin khóa học.");
                safeSendMessage({ action: "FINISHED" });
                return;
            }
            this.courseId = json.elements[0].id;
            log(`📌 Course ID: ${this.courseId} | Chế độ: ${this.mode === 'safe' ? '🛡️ Safe Farm' : '⚡ Turbo'}`);

            // Fetch already completed items to prevent redundant API calls
            this.completedIds = await this.getCompletedItemIds();
            log(`✅ Phát hiện ${this.completedIds.size} bài đã hoàn thành trước đó (sẽ tự động bỏ qua).`);

            const items = json.linked["onDemandCourseMaterialItems.v2"] || [];
            log(`📚 Tổng cộng ${items.length} bài học trong khóa.`);

            let processedCount = 0;
            let skippedAlreadyDone = 0;

            // Send initial progress update
            const initialDone = this.completedIds.size;
            const initPct = items.length > 0 ? ((initialDone / items.length) * 100).toFixed(0) : 0;
            safeSendMessage({
                action: "PROGRESS_UPDATE",
                percent: initPct,
                completed: initialDone,
                total: items.length,
                itemName: "Bắt đầu quét..."
            });

            for (const item of items) {
                if (this.isStopped) {
                    log("⏹ Đã dừng theo yêu cầu.");
                    break;
                }

                // Check if already completed
                if (this.completedIds.has(item.id)) {
                    skippedAlreadyDone++;
                    continue;
                }

                const typeName = item.contentSummary ? item.contentSummary.typeName : "";
                if (typeName === "lecture") {
                    log(`[${++processedCount}] 🎬 Video: ${item.name}`);
                    await this.watchItem(item);
                } else if (typeName === "supplement" || typeName === "ungradedWidget") {
                    log(`[${++processedCount}] 📖 Reading: ${item.name}`);
                    await this.readItem(item.id);
                }

                // Send live progress update to popup
                const currentDone = skippedAlreadyDone + processedCount;
                const pct = items.length > 0 ? ((currentDone / items.length) * 100).toFixed(0) : 0;
                safeSendMessage({
                    action: "PROGRESS_UPDATE",
                    percent: pct,
                    completed: currentDone,
                    total: items.length,
                    itemName: item.name
                });

                // Delay between items based on mode
                if (this.mode === 'safe') {
                    const jitter = 2000 + Math.floor(Math.random() * 3000); // 2 - 5s
                    await new Promise(r => setTimeout(r, jitter));
                } else {
                    await new Promise(r => setTimeout(r, 400));
                }
            }

            if (!this.isStopped) {
                log(`🎉 Hoàn tất! Đã xử lý ${processedCount} bài học mới (${skippedAlreadyDone} bài cũ đã bỏ qua).`);
                // Auto check certificate
                await this.getCertificateInfo();
            }
            safeSendMessage({ action: "FINISHED" });
        } catch (err) {
            log(`❌ Lỗi khi quét khóa học: ${err.message}`);
            safeSendMessage({ action: "FINISHED" });
        }
    }

    // --- AUDIT TIẾN ĐỘ KHÓA HỌC (TÌM BÀI SÓT / 99% BUG) ---
    async auditCourse(slug) {
        this.slug = slug;
        const ok = await this.getUserId();
        if (!ok) {
            log("❌ Không lấy được thông tin tài khoản.");
            safeSendMessage({ action: "FINISHED" });
            return;
        }

        const params = new URLSearchParams({
            "q": "slug",
            "slug": slug,
            "includes": "modules,lessons,items",
            "fields": "moduleIds,onDemandCourseMaterialModules.v1(name,slug,lessonIds),onDemandCourseMaterialLessons.v1(name,slug,elementIds),onDemandCourseMaterialItems.v2(name,slug,timeCommitment,contentSummary)",
            "showLockedItems": "true"
        });

        try {
            log("🔍 Đang phân tích tiến độ thực tế toàn bộ khóa học...");
            const res = await fetch(BASE_URL + "onDemandCourseMaterials.v2/?" + params.toString(), {
                headers: this.getHeaders()
            });
            const json = await res.json();
            if (!json.elements || json.elements.length === 0) {
                log("❌ Không tìm thấy thông tin khóa học.");
                safeSendMessage({ action: "FINISHED" });
                return;
            }
            this.courseId = json.elements[0].id;
            const items = json.linked["onDemandCourseMaterialItems.v2"] || [];
            const completedIds = await this.getCompletedItemIds();

            const uncompleted = [];
            items.forEach(item => {
                const isDone = completedIds.has(item.id);
                if (!isDone) {
                    const type = item.contentSummary ? item.contentSummary.typeName : "unknown";
                    uncompleted.push({ name: item.name, type: type, id: item.id });
                }
            });

            const completedCount = items.length - uncompleted.length;
            const pct = items.length > 0 ? ((completedCount / items.length) * 100).toFixed(1) : 0;

            log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            log(`📊 KẾT QUẢ KIỂM TRA TIẾN ĐỘ:`);
            log(`• Tổng số bài học: ${items.length}`);
            log(`• Đã hoàn thành: ${completedCount}/${items.length} (${pct}%)`);
            
            if (uncompleted.length === 0) {
                log(`🎉 KHÓA HỌC ĐÃ HOÀN THÀNH 100%! Bạn đủ điều kiện nhận chứng chỉ.`);
                await this.getCertificateInfo();
            } else {
                log(`⚠️ CÒN ${uncompleted.length} BÀI CHƯA HOÀN THÀNH:`);
                uncompleted.slice(0, 10).forEach((u, i) => {
                    log(`  ${i + 1}. [${u.type.toUpperCase()}] ${u.name}`);
                });
                if (uncompleted.length > 10) {
                    log(`  ... và ${uncompleted.length - 10} bài khác.`);
                }
            }
            log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            safeSendMessage({
                action: "PROGRESS_UPDATE",
                percent: Math.round(pct),
                completed: completedCount,
                total: items.length,
                itemName: uncompleted.length === 0 ? "100% Hoàn tất!" : `Còn ${uncompleted.length} bài chưa xong`
            });
            safeSendMessage({ action: "FINISHED" });
        } catch (e) {
            log("❌ Lỗi kiểm tra tiến độ: " + e.message);
            safeSendMessage({ action: "FINISHED" });
        }
    }

    // --- TRUY XUẤT LINK VERIFY CHỨNG CHỈ CHO FAP ---
    async getCertificateInfo() {
        try {
            log("🎓 Đang truy xuất thông tin chứng chỉ & link Verify...");
            const url = `${BASE_URL}openCourseMemberships.v1/${this.userId}~${this.courseId}`;
            const res = await fetch(url, { headers: this.getHeaders() });
            if (res.ok) {
                const json = await res.json();
                const elem = json.elements ? json.elements[0] : json;
                let certCode = elem ? (elem.certificateCode || elem.v1CertificateCode) : null;
                
                // Profile name
                let fullName = "Học viên Coursera";
                try {
                    const profileRes = await fetch(`${BASE_URL}externalBasicProfiles.v1?q=me`, { headers: this.getHeaders() });
                    if (profileRes.ok) {
                        const profJson = await profileRes.json();
                        if (profJson.elements && profJson.elements[0]) {
                            fullName = profJson.elements[0].fullName || profJson.elements[0].name;
                        }
                    }
                } catch (_) {}

                if (!certCode) {
                    // Fallback 1: query certificateAccomplishments.v1
                    try {
                        const certRes = await fetch(`${BASE_URL}certificateAccomplishments.v1?q=my`, { headers: this.getHeaders() });
                        if (certRes.ok) {
                            const certJson = await certRes.json();
                            if (certJson.elements) {
                                const matchCert = certJson.elements.find(c => c.courseId === this.courseId);
                                if (matchCert && matchCert.id) {
                                    certCode = matchCert.id;
                                }
                            }
                        }
                    } catch (_) {}
                }

                if (certCode) {
                    const verifyUrl = `https://www.coursera.org/verify/${certCode}`;
                    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    log(`✅ LINK VERIFY CHỨNG CHỈ (NỘP FAP):`);
                    log(`🔗 ${verifyUrl}`);
                    log(`👤 Tên hiển thị trên bằng: "${fullName}"`);
                    log(`👉 Hãy kiểm tra kỹ tên trên bằng có khớp Họ Tên trên FAP không!`);
                    await copyTextToClipboard(verifyUrl);
                    log(`📋 (Đã tự động copy link verify vào Clipboard!)`);
                    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    safeSendMessage({
                        action: "CERT_FOUND",
                        verifyUrl: verifyUrl,
                        studentName: fullName,
                        certCode: certCode
                    });
                    safeSendMessage({ action: "FINISHED" });
                    return;
                }
            }
            log("ℹ️ Môn học chưa cấp Certificate Code. Hãy chắc chắn bạn đã Passed tất cả Graded Quizzes và Peer Reviews!");
            safeSendMessage({ action: "FINISHED" });
        } catch (e) {
            console.warn("Cert fetch error:", e);
            safeSendMessage({ action: "FINISHED" });
        }
    }

    async getVideoMetadata(itemId) {
        const params = new URLSearchParams({
            "includes": "video",
            "fields": "disableSkippingForward,startMs,endMs"
        });
        try {
            const response = await fetch(BASE_URL + `onDemandLectureVideos.v1/${this.courseId}~${itemId}?` + params.toString(), {
                headers: this.getHeaders()
            });
            const json = await response.json();
            return {
                can_skip: !json.elements[0].disableSkippingForward,
                tracking_id: json.linked["onDemandVideos.v1"][0].id
            };
        } catch (e) {
            return null;
        }
    }

    async watchItem(item) {
        if (this.isStopped) return;
        const metadata = await this.getVideoMetadata(item.id);
        if (!metadata) return;

        if (this.mode === 'safe') {
            await this.startItem(item);
            await new Promise(r => setTimeout(r, 1200 + Math.floor(Math.random() * 800)));
            await this.updateProgress(item, metadata);
            await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 600)));
            await this.endItem(item, metadata);
        } else {
            if (metadata.can_skip) {
                await this.endItem(item, metadata);
            } else {
                await this.startItem(item);
                await this.updateProgress(item, metadata);
                await this.endItem(item, metadata);
            }
        }
    }

    async startItem(item) {
        if (this.isStopped) return;
        const url = `${BASE_URL}opencourse.v1/user/${this.userId}/course/${this.slug}/item/${item.id}/lecture/videoEvents/play?autoEnroll=false`;
        await fetch(url, {
            method: 'POST',
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentRequestBody: {} })
        }).catch(() => {});
    }

    async endItem(item, metadata) {
        if (this.isStopped) return;
        const url = `${BASE_URL}opencourse.v1/user/${this.userId}/course/${this.slug}/item/${item.id}/lecture/videoEvents/ended?autoEnroll=false`;
        await fetch(url, {
            method: 'POST',
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentRequestBody: {} })
        }).catch(() => {});
    }

    async updateProgress(item, metadata) {
        if (this.isStopped) return;
        const url = `${BASE_URL}onDemandVideoProgresses.v1/${this.userId}~${this.courseId}~${metadata.tracking_id}`;
        const body = {
            videoProgressId: `${this.userId}~${this.courseId}~${metadata.tracking_id}`,
            viewedUpTo: (item.timeCommitment || 0) + 2000
        };
        await fetch(url, {
            method: 'PUT',
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).catch(() => {});
    }

    async readItem(itemId) {
        if (this.isStopped) return;
        if (this.mode === 'safe') {
            await new Promise(r => setTimeout(r, 1500 + Math.floor(Math.random() * 1200)));
        }
        const url = `${BASE_URL}onDemandSupplementCompletions.v1`;
        const body = { courseId: this.courseId, itemId: itemId, userId: Number(this.userId) };
        await fetch(url, {
            method: 'POST',
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).catch(() => {});
    }

    // --- AUTO DO PEER ASSIGNMENT ---
    async autoDoPeerAssignment() {
        log("📝 Đang bắt đầu tự động nộp bài Peer Assignment...");

        const template = getRandomItem(PEER_SUBMISSION_TEMPLATES);

        const simulateInput = async (element, text) => {
            element.focus();
            const beforeInputEvent = new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: text,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(beforeInputEvent);
            document.execCommand('insertText', false, text);
            element.dispatchEvent(new InputEvent('input', {
                inputType: 'insertText',
                data: text,
                bubbles: true
            }));
            ['keydown', 'keyup'].forEach(type => {
                element.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space', bubbles: true }));
            });
            await new Promise(r => setTimeout(r, 100));
        };

        const titleInput = document.querySelector('input#title') || document.querySelector('input[aria-label="Project Title"]');
        if (titleInput) {
            await simulateInput(titleInput, template.title);
        }

        const contentInputs = Array.from(document.querySelectorAll('textarea, div[data-slate-editor="true"], div[role="textbox"]'))
            .filter(el => el !== titleInput);

        for (const input of contentInputs) {
            const currentVal = input.value || input.textContent || "";
            if (currentVal.trim().length > 20) continue;
            await simulateInput(input, template.body);
        }

        const agreementBox = document.querySelector('input#agreement-checkbox-base') || document.querySelector('input[type="checkbox"]');
        if (agreementBox && !agreementBox.checked) {
            agreementBox.click();
            agreementBox.checked = true;
            agreementBox.dispatchEvent(new Event('change', { bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 1000));

        const buttons = Array.from(document.querySelectorAll('button'));
        const submitBtn = buttons.find(b => {
            const text = b.textContent.trim().toLowerCase();
            return ['submit', 'gửi', 'post', 'nộp bài'].some(w => text.includes(w)) && !b.disabled;
        });

        if (submitBtn) {
            submitBtn.click();
            await new Promise(r => setTimeout(r, 1500));
            const confirmButtons = Array.from(document.querySelectorAll('button'));
            const finalConfirm = confirmButtons.find(b => {
                const text = b.textContent.trim().toLowerCase();
                return ['yes', 'có', 'confirm', 'xác nhận', 'submit'].some(w => text.includes(w)) && b !== submitBtn;
            });

            if (finalConfirm) {
                finalConfirm.click();
            }
            log("🎉 Đã nộp bài Peer Assignment thành công!");
        } else {
            log("⚠️ Không tìm thấy nút Submit hoặc nút đang bị khóa.");
        }
        safeSendMessage({ action: "FINISHED" });
    }

    // --- AUTO GRADE PEER ---
    async autoGradePeer(expectedCount = 3) {
        log(`⭐ Bắt đầu chấm chéo Peer Review (Mục tiêu: ${expectedCount} bài)...`);
        let gradedCount = 0;

        const checkRemaining = () => {
            const countTd = document.querySelector('[data-testid="review-count"]');
            if (countTd) {
                const text = countTd.textContent.trim().toLowerCase();
                if (text.includes('done') || text.includes('0 left') || text.includes('0 còn lại')) return 0;
                const match = text.match(/(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }
            return 999;
        };

        const waitFor = async (selector, timeout = 10000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const el = document.querySelector(selector);
                if (el) return el;
                await new Promise(r => setTimeout(r, 500));
            }
            return null;
        };

        const waitForButtons = async (searchTerms, timeout = 10000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                if (this.isStopped) return null;
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const found = buttons.find(b => {
                    const text = b.textContent.trim().toLowerCase();
                    const isMatch = searchTerms.some(w => text.includes(w)) && !b.disabled;
                    if (!isMatch) return false;
                    const isNav = b.closest('nav') || b.closest('footer') ||
                        b.closest('[class*="navigation"]') || b.closest('[class*="Footer"]');
                    if (isNav) return false;
                    if (text.includes('next item') || text.includes('mục tiếp theo') ||
                        text.includes('previous item') || text.includes('mục trước')) return false;
                    return true;
                });
                if (found) return found;
                await new Promise(r => setTimeout(r, 500));
            }
            return null;
        };

        while (gradedCount < expectedCount) {
            if (this.isStopped) break;

            const remaining = checkRemaining();
            if (remaining === 0) {
                log("🎉 Đã hoàn thành đủ số lượng bài cần chấm!");
                break;
            }

            if (!window.location.href.includes('/peer/') && !window.location.href.includes('/grading/')) break;

            const firstRadio = await waitFor('input[type="radio"]');
            if (!firstRadio) {
                const nextPeerBtn = await waitForButtons(['review another', 'chấm bài khác', 'review more'], 3000);
                if (nextPeerBtn) {
                    nextPeerBtn.click();
                    await new Promise(r => setTimeout(r, 4000));
                    continue;
                } else {
                    break;
                }
            } else {
                // Smart Rubric Scoring: choose option with highest score
                const radioButtons = document.querySelectorAll('input[type="radio"]');
                const radioGroups = {};
                radioButtons.forEach(rb => {
                    if (!radioGroups[rb.name]) radioGroups[rb.name] = [];
                    radioGroups[rb.name].push(rb);
                });

                for (const name in radioGroups) {
                    const group = radioGroups[name];
                    let bestOption = group[group.length - 1]; // fallback
                    let maxScore = -1;

                    for (const rb of group) {
                        const parent = rb.closest('label, div.rc-Option, tr, [role="radio"]') || rb.parentElement;
                        const text = (parent ? parent.innerText : '') + ' ' + (rb.value || '');
                        const match = text.match(/(\d+)\s*(?:points?|pts?|điểm)?/i);
                        if (match) {
                            const sc = parseInt(match[1], 10);
                            if (sc > maxScore) {
                                maxScore = sc;
                                bestOption = rb;
                            }
                        }
                    }

                    if (bestOption && !bestOption.checked) {
                        bestOption.click();
                        bestOption.checked = true;
                        bestOption.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                // Dynamic randomized feedback
                const feedbackText = getRandomItem(PEER_FEEDBACK_TEMPLATES);
                const textInputs = Array.from(document.querySelectorAll('textarea, div[data-slate-editor="true"], div[role="textbox"]'));

                for (const input of textInputs) {
                    const currentVal = input.value || input.textContent || "";
                    if (currentVal.trim().length > 5) continue;
                    input.focus();
                    if (input.tagName === 'TEXTAREA') {
                        input.value = feedbackText;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        document.execCommand('insertText', false, feedbackText);
                        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
                    }
                    await new Promise(r => setTimeout(r, 200));
                }

                await new Promise(r => setTimeout(r, 1000));
                const submitBtn = await waitForButtons(['submit', 'gửi', 'done', 'hoàn thành']);
                if (submitBtn) {
                    submitBtn.click();
                    await new Promise(r => setTimeout(r, 4000));
                    log(`✔ Đã chấm xong bài ${++gradedCount}/${expectedCount}.`);
                } else {
                    break;
                }
            }
        }

        if (gradedCount >= expectedCount) {
            log(`🎉 Hoàn thành xuất sắc chấm chéo ${gradedCount} bài!`);
        }
        safeSendMessage({ action: "FINISHED" });
    }

    // --- AUTO DISCUSSION ---
    async autoFillDiscussion() {
        let editor = document.querySelector('div[data-slate-editor="true"]') || document.querySelector('div[role="textbox"]') || document.querySelector('textarea');
        
        if (!editor) {
            // Check if there is a trigger button to open the reply form
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const triggerBtn = buttons.find(b => {
                const t = b.textContent.trim().toLowerCase();
                return ['reply to prompt', 'start a conversation', 'add a response', 'reply', 'phản hồi', 'trả lời'].some(k => t.includes(k));
            });
            if (triggerBtn) {
                log("ℹ️ Đang mở form phản hồi thảo luận...");
                triggerBtn.click();
                await new Promise(r => setTimeout(r, 1200));
                editor = document.querySelector('div[data-slate-editor="true"]') || document.querySelector('div[role="textbox"]') || document.querySelector('textarea');
            }
        }

        if (!editor) {
            log("❌ Không tìm thấy ô nhập phản hồi thảo luận.");
            return;
        }

        editor.focus();
        const textToFill = getRandomItem(DISCUSSION_TEMPLATES);

        if (editor.tagName === 'TEXTAREA') {
            editor.value = textToFill;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            const beforeInputEvent = new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: textToFill,
                bubbles: true,
                cancelable: true
            });
            editor.dispatchEvent(beforeInputEvent);
            document.execCommand('insertText', false, textToFill);
            editor.dispatchEvent(new InputEvent('input', {
                inputType: 'insertText',
                data: textToFill,
                bubbles: true
            }));
        }

        await new Promise(r => setTimeout(r, 1000));

        const buttons = Array.from(document.querySelectorAll('button'));
        const postBtn = buttons.find(b => {
            const textContent = b.textContent.trim().toLowerCase();
            return ['post', 'reply', 'gửi', 'phản hồi', 'trả lời'].some(word => textContent.includes(word));
        });

        if (postBtn) {
            postBtn.click();
            log("💬 Đã gửi bài thảo luận thành công!");
        } else {
            log("⚠️ Không tìm thấy nút Post/Reply.");
        }
        safeSendMessage({ action: "FINISHED" });
    }

    // --- CALL AI API WITH MODEL FALLBACK CHAINS ---
    async callAiQuizSolver(provider, apiKey, prompt) {
        // Auto-correct provider based on key format if user mismatched them
        if (apiKey.startsWith('gsk_') && provider !== 'groq') {
            log("ℹ️ Nhận diện khóa Groq (gsk_...), tự động chuyển sang Groq.");
            provider = 'groq';
        } else if (apiKey.startsWith('sk-') && provider !== 'openai') {
            log("ℹ️ Nhận diện khóa OpenAI (sk-...), tự động chuyển sang OpenAI.");
            provider = 'openai';
        } else if (apiKey.startsWith('AIzaSy') && provider !== 'gemini') {
            log("ℹ️ Nhận diện khóa Google AI Studio, tự động chuyển sang Gemini.");
            provider = 'gemini';
        }

        if (provider === 'gemini') {
            // Fallback chain for Gemini: 2.0 Flash -> 1.5 Flash -> 1.5 Flash Latest
            const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
            let lastError = null;
            for (const model of models) {
                try {
                    log(`🌐 Đang kết nối tới Google Gemini (${model})...`);
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                response_mime_type: "application/json",
                                temperature: 0.1
                            }
                        })
                    });
                    const json = await res.json();
                    if (!res.ok) {
                        const errMsg = json.error?.message || `Lỗi HTTP ${res.status}`;
                        // If model not found (404), fall back to next model
                        if (res.status === 404 || errMsg.toLowerCase().includes('not found')) {
                            console.warn(`Gemini model ${model} not available, trying fallback...`);
                            lastError = new Error(errMsg);
                            continue;
                        }
                        throw new Error(errMsg);
                    }
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) throw new Error("Gemini không trả về văn bản đáp án.");
                    return extractJsonFromText(text);
                } catch (err) {
                    lastError = err;
                    if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
                        continue;
                    }
                    throw err;
                }
            }
            throw lastError || new Error("Không thể kết nối tới Google Gemini API.");

        } else if (provider === 'groq') {
            const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
            let lastError = null;
            for (const model of models) {
                try {
                    log(`🌐 Đang kết nối tới Groq (${model})...`);
                    const url = `https://api.groq.com/openai/v1/chat/completions`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                { role: "system", content: "You are an expert academic assistant solving Coursera quizzes with 100% accuracy. Respond only with JSON." },
                                { role: "user", content: prompt }
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0.1
                        })
                    });
                    const json = await res.json();
                    if (!res.ok) {
                        const errMsg = json.error?.message || `Lỗi HTTP ${res.status}`;
                        if (res.status === 404 || errMsg.toLowerCase().includes('decommissioned') || errMsg.toLowerCase().includes('not found')) {
                            lastError = new Error(errMsg);
                            continue;
                        }
                        throw new Error(errMsg);
                    }
                    const text = json.choices?.[0]?.message?.content;
                    if (!text) throw new Error("Groq không trả về nội dung đáp án.");
                    return extractJsonFromText(text);
                } catch (err) {
                    lastError = err;
                    if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('decommissioned'))) {
                        continue;
                    }
                    throw err;
                }
            }
            throw lastError || new Error("Không thể kết nối tới Groq API.");

        } else if (provider === 'openai') {
            log(`🌐 Đang kết nối tới OpenAI (gpt-4o-mini)...`);
            const url = `https://api.openai.com/v1/chat/completions`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are an expert academic assistant solving Coursera quizzes with 100% accuracy. Respond only with JSON." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1
                })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || "OpenAI API Error");
            const text = json.choices?.[0]?.message?.content;
            if (!text) throw new Error("OpenAI không trả về nội dung đáp án.");
            return extractJsonFromText(text);
        }
    }

    // --- AUTO DO QUIZ (BATCH AI CALL) ---
    async autoDoQuiz(provider, apiKey) {
        log(`🧠 Bắt đầu quét câu hỏi đề thi...`);
        let questions = extractQuizQuestions();

        if (questions.length === 0) {
            // Check if user is on the cover page with Start/Resume/Retake button
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const startBtn = buttons.find(b => {
                const t = b.textContent.trim().toLowerCase();
                return ['start assignment', 'start attempt', 'resume assignment', 'resume', 'retake', 'start quiz', 'take quiz', 'bắt đầu', 'làm bài', 'try again'].some(k => t.includes(k));
            });
            if (startBtn) {
                log("ℹ️ Phát hiện nút vào thi. Đang tự động mở bài thi...");
                startBtn.click();
                await new Promise(r => setTimeout(r, 4000));
                questions = extractQuizQuestions();
            }
        }

        if (questions.length === 0) {
            log("❌ Không tìm thấy câu hỏi trắc nghiệm nào trên trang hiện tại!");
            log("👉 Hãy chắc chắn bạn đã nhấn 'Start' hoặc 'Resume' trên Coursera để vào màn hình có câu hỏi!");
            safeSendMessage({ action: "FINISHED" });
            return;
        }

        log(`📝 Tìm thấy ${questions.length} câu hỏi. Đang tạo Batch Prompt gửi lên ${provider.toUpperCase()}...`);
        const prompt = generateQuizPrompt(questions);

        try {
            const aiResponseJson = await this.callAiQuizSolver(provider, apiKey, prompt);

            if (!aiResponseJson) {
                throw new Error("Không thể phân tích dữ liệu JSON trả về từ AI.");
            }

            log("🎯 Đã nhận đáp án từ AI! Tiến hành tích chọn trên giao diện bài thi...");
            const filled = await applyQuizAnswers(aiResponseJson, questions);
            if (filled > 0) {
                log(`🎉 Hoàn tất! Đã tự động điền/tích ${filled} vị trí đáp án (và tự tích cam kết danh dự).`);
                log("👉 Mời bạn kiểm tra lại các đáp án trên màn hình và bấm 'Nộp bài' (Submit)!");
            } else {
                log("⚠️ AI đã phản hồi nhưng không khớp được ô nào để điền. Hãy kiểm tra lại màn hình câu hỏi!");
            }
            safeSendMessage({ action: "FINISHED" });

        } catch (e) {
            log(`❌ Lỗi gọi AI: ${e.message}`);
            if (e.message && e.message.includes('API_KEY_INVALID')) {
                log("👉 Khóa API của bạn không đúng hoặc đã hết hạn. Hãy kiểm tra lại trong tab Quiz AI.");
            } else if (e.message && (e.message.includes('quota') || e.message.includes('exhausted'))) {
                log("👉 Bạn đã chạm hạn mức miễn phí (Rate Limit/Quota). Hãy thử chuyển sang Groq Llama 3.3 hoặc dùng chế độ Zero-Key.");
            }
            safeSendMessage({ action: "FINISHED" });
        }
    }

    // --- ZERO-KEY MODE: COPY PROMPT ---
    async copyQuizPrompt() {
        log("📋 Đang cào toàn bộ câu hỏi đề thi...");
        let questions = extractQuizQuestions();

        if (questions.length === 0) {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const startBtn = buttons.find(b => {
                const t = b.textContent.trim().toLowerCase();
                return ['start assignment', 'start attempt', 'resume', 'retake', 'start quiz', 'take quiz', 'bắt đầu'].some(k => t.includes(k));
            });
            if (startBtn) {
                log("ℹ️ Phát hiện nút vào thi. Đang tự động mở bài thi...");
                startBtn.click();
                await new Promise(r => setTimeout(r, 3500));
                questions = extractQuizQuestions();
            }
        }

        if (questions.length === 0) {
            log("❌ Không tìm thấy câu hỏi nào! Hãy đảm bảo bạn đang ở trang bài thi (Quiz Attempt).");
            safeSendMessage({ action: "FINISHED" });
            return;
        }

        const prompt = generateQuizPrompt(questions);
        const copied = await copyTextToClipboard(prompt);

        if (copied) {
            log(`✅ ĐÃ COPY ĐỀ THI (${questions.length} câu) VÀO CLIPBOARD!`);
            log("👉 Hãy mở ChatGPT / Gemini Web, nhấn Ctrl+V để dán và lấy kết quả JSON.");
        } else {
            log("⚠️ Không thể tự động copy vào clipboard. Hãy kiểm tra quyền trình duyệt.");
        }
        safeSendMessage({ action: "FINISHED" });
    }

    // --- ZERO-KEY MODE: APPLY JSON ANSWERS ---
    async applyAnswersFromJson(jsonString) {
        try {
            const parsed = extractJsonFromText(jsonString);
            if (!parsed) {
                log("❌ Chuỗi JSON không hợp lệ! Hãy chắc chắn bạn đã copy đúng định dạng từ AI.");
                safeSendMessage({ action: "FINISHED" });
                return;
            }

            const questions = extractQuizQuestions();
            const count = await applyQuizAnswers(parsed, questions);
            log(`🎉 Đã điền thành công ${count} đáp án từ kết quả JSON của bạn!`);
            safeSendMessage({ action: "FINISHED" });
        } catch (e) {
            log(`❌ Lỗi áp dụng JSON: ${e.message}`);
            safeSendMessage({ action: "FINISHED" });
        }
    }
}

// ============================================================
// MESSAGE LISTENER (From Popup)
// ============================================================

function getSlugFromUrl(url) {
    if (!url) return null;
    const match = url.match(/learn\/([^\/\?#]+)/);
    return match ? match[1] : null;
}

let activeSkipper = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SKIPPING") {
        const slug = getSlugFromUrl(window.location.href);
        if (!slug) {
            log("❌ Không nhận diện được slug khóa học. Hãy mở trang chủ khóa học (/home/welcome hoặc /home/week/1)!");
            sendResponse({ status: "error" });
            safeSendMessage({ action: "FINISHED" });
            return true;
        }
        activeSkipper = new SkiperaJS(request.mode || 'safe');
        activeSkipper.getUserId().then(success => {
            if (success) {
                activeSkipper.getCourse(slug);
            } else {
                log("❌ Không lấy được User ID. Hãy chắc chắn bạn đã đăng nhập Coursera!");
                safeSendMessage({ action: "FINISHED" });
            }
        }).catch(() => {
            safeSendMessage({ action: "FINISHED" });
        });
        sendResponse({ status: "started" });
    } else if (request.action === "AUDIT_COURSE") {
        const slug = getSlugFromUrl(window.location.href);
        if (!slug) {
            log("❌ Không nhận diện được slug khóa học. Hãy mở trang chủ khóa học!");
            sendResponse({ status: "error" });
            safeSendMessage({ action: "FINISHED" });
            return true;
        }
        activeSkipper = new SkiperaJS();
        activeSkipper.auditCourse(slug);
        sendResponse({ status: "auditing" });
    } else if (request.action === "GET_CERT_INFO") {
        const slug = getSlugFromUrl(window.location.href);
        if (!slug) {
            log("❌ Hãy mở trang khóa học trên Coursera!");
            sendResponse({ status: "error" });
            safeSendMessage({ action: "FINISHED" });
            return true;
        }
        activeSkipper = new SkiperaJS();
        activeSkipper.slug = slug;
        activeSkipper.getUserId().then(async ok => {
            if (ok) {
                // First get courseId
                const params = new URLSearchParams({ "q": "slug", "slug": slug });
                const res = await fetch(BASE_URL + "onDemandCourseMaterials.v2/?" + params.toString(), { headers: activeSkipper.getHeaders() });
                const json = await res.json();
                if (json.elements && json.elements[0]) {
                    activeSkipper.courseId = json.elements[0].id;
                    await activeSkipper.getCertificateInfo();
                } else {
                    safeSendMessage({ action: "FINISHED" });
                }
            } else {
                safeSendMessage({ action: "FINISHED" });
            }
        }).catch(() => {
            safeSendMessage({ action: "FINISHED" });
        });
        sendResponse({ status: "getting_cert" });
    } else if (request.action === "STOP_SKIPPING") {
        if (activeSkipper) {
            activeSkipper.stop();
            sendResponse({ status: "stopped" });
        } else {
            sendResponse({ status: "not_running" });
        }
    } else if (request.action === "AUTO_DISCUSSION") {
        const skipper = activeSkipper || new SkiperaJS();
        skipper.autoFillDiscussion();
        sendResponse({ status: "processing" });
    } else if (request.action === "AUTO_GRADE_PEER") {
        const skipper = activeSkipper || new SkiperaJS();
        skipper.autoGradePeer(request.count || 3);
        sendResponse({ status: "processing" });
    } else if (request.action === "AUTO_DO_ASSIGNMENT") {
        const skipper = activeSkipper || new SkiperaJS();
        skipper.autoDoPeerAssignment();
        sendResponse({ status: "processing" });
    } else if (request.action === "AUTO_DO_QUIZ") {
        const skipper = activeSkipper || new SkiperaJS();
        skipper.autoDoQuiz(request.provider, request.apiKey);
        sendResponse({ status: "processing" });
    } else if (request.action === "COPY_QUIZ_PROMPT") {
        const skipper = activeSkipper || new SkiperaJS();
        skipper.copyQuizPrompt();
        sendResponse({ status: "processing" });
    } else if (request.action === "APPLY_QUIZ_ANSWERS") {
        const skipper = activeSkipper || new SkiperaJS();
        skipper.applyAnswersFromJson(request.jsonAnswers);
        sendResponse({ status: "processing" });
    } else {
        sendResponse({ status: "unknown_action" });
    }
    return true;
});
