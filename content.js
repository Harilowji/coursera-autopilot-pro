// ============================================================
// Coursera Skipper Pro - Content Script v2.0
// All-in-One: Skip Videos, Readings, Auto Peer, Discussion & AI Quiz Solver
// ============================================================

const BASE_URL = "/api/";

// Helper to log to popup & background
function log(msg) {
    console.log("[SkipperPro] " + msg);
    chrome.runtime.sendMessage({ action: "LOG", message: msg });
}

// Cookie helper
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Randomizer helpers
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
    
    // Select question containers
    let questionBlocks = Array.from(document.querySelectorAll(
        'fieldset, .rc-FormPartsQuestion, .rc-QuizQuestion, [data-testid="question-container"], div[class*="question-block"], div[class*="QuestionBlock"], div[class*="rc-FormPart"]'
    ));

    // Fallback: group by input ancestors
    if (questionBlocks.length === 0) {
        const inputs = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
        const containerSet = new Set();
        inputs.forEach(inp => {
            const cont = inp.closest('fieldset, form, div[role="group"], div[class*="Question"], div[class*="question"]');
            if (cont) containerSet.add(cont);
        });
        questionBlocks = Array.from(containerSet);
    }

    questionBlocks.forEach((qEl, qIndex) => {
        const radioInputs = Array.from(qEl.querySelectorAll('input[type="radio"], [role="radio"]'));
        const checkInputs = Array.from(qEl.querySelectorAll('input[type="checkbox"], [role="checkbox"]'));
        const textInputs = Array.from(qEl.querySelectorAll('textarea, input[type="text"]'));

        let qType = "single";
        let inputElements = radioInputs;
        if (checkInputs.length > 0) {
            qType = "multiple";
            inputElements = checkInputs;
        } else if (textInputs.length > 0 && radioInputs.length === 0) {
            qType = "text";
            inputElements = textInputs;
        }

        if (inputElements.length === 0) return;

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
            ".rc-QuestionText"
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
            rawText = rawText.replace(/^Question\s*\d+[\s\.\:]*/i, '');
            qText = rawText.split('\n').filter(line => line.trim().length > 0)[0] || `Question ${qIndex + 1}`;
        }

        qText = qText.replace(/^Question\s*\d+[\s\.\:]*/i, '').trim();

        // Extract options
        const options = [];
        if (qType !== "text") {
            inputElements.forEach((inp, oIndex) => {
                const parentOpt = inp.closest('label, div.rc-Option, [role="radio"], [role="checkbox"], div[class*="Option"]') || inp.parentElement;
                let optText = "";
                if (parentOpt) {
                    optText = parentOpt.innerText.trim();
                } else {
                    optText = inp.value || `Option ${oIndex + 1}`;
                }

                // Clean option prefixes
                optText = optText.replace(/^[a-zA-Z0-9][\.\)\-]\s*/, '').trim();

                options.push({
                    index: oIndex,
                    text: optText,
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
            textElement: qType === "text" ? inputElements[0] : null
        });
    });

    return questions;
}

function generateQuizPrompt(questions) {
    let prompt = "You are an expert academic assistant solving a Coursera quiz with 100% accuracy.\n";
    prompt += "Analyze each question carefully and return ONLY a single, valid JSON object in this exact format:\n";
    prompt += "{\n  \"answers\": {\n";
    prompt += "    \"1\": [0],\n";
    prompt += "    \"2\": [1, 2]\n";
    prompt += "  }\n}\n";
    prompt += "RULES:\n";
    prompt += "- Keys are question numbers (\"1\", \"2\", ...).\n";
    prompt += "- Values are arrays of 0-based option index numbers that represent the correct choices.\n";
    prompt += "- For 'Single Choice': select exactly one index (e.g. [0]).\n";
    prompt += "- For 'Multiple Choice': select all correct indices (e.g. [1, 2]).\n";
    prompt += "- Return ONLY raw JSON without explanation.\n\n";
    prompt += "=== QUIZ QUESTIONS ===\n\n";

    questions.forEach(q => {
        prompt += `Question ${q.displayNumber} (${q.type === 'multiple' ? 'Multiple Choice - Select all that apply' : 'Single Choice - Select one'}):\n`;
        prompt += `${q.text}\n`;
        if (q.options.length > 0) {
            prompt += "Options:\n";
            q.options.forEach(opt => {
                prompt += `  [${opt.index}]: ${opt.text}\n`;
            });
        }
        prompt += "\n";
    });

    return prompt;
}

function applyQuizAnswers(parsedAnswers, questions) {
    let answersMap = parsedAnswers.answers || parsedAnswers;
    let filledCount = 0;

    questions.forEach(q => {
        let key = String(q.displayNumber);
        let selectedIndices = answersMap[key] !== undefined ? answersMap[key] : answersMap[String(q.id)];

        if (selectedIndices !== undefined) {
            if (!Array.isArray(selectedIndices)) {
                selectedIndices = [selectedIndices];
            }

            selectedIndices.forEach(idx => {
                const intIdx = parseInt(idx, 10);
                const opt = q.options.find(o => o.index === intIdx);
                if (opt) {
                    try {
                        opt.clickTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        opt.clickTarget.click();
                        if (opt.element && !opt.element.checked) {
                            opt.element.checked = true;
                            opt.element.dispatchEvent(new Event('input', { bubbles: true }));
                            opt.element.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        filledCount++;
                    } catch (e) {
                        console.warn("Click option error:", e);
                    }
                }
            });
        }
    });

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
            if (!response.ok) return false;
            const json = await response.json();
            if (json.elements && json.elements[0] && json.elements[0].id) {
                this.userId = json.elements[0].id;
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
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
                return;
            }
            this.courseId = json.elements[0].id;
            log(`📌 Course ID: ${this.courseId} | Chế độ: ${this.mode === 'safe' ? '🛡️ Safe Farm' : '⚡ Turbo'}`);

            const items = json.linked["onDemandCourseMaterialItems.v2"] || [];
            log(`📚 Tìm thấy tổng cộng ${items.length} bài học.`);

            let count = 0;
            for (const item of items) {
                if (this.isStopped) {
                    log("⏹ Đã dừng theo yêu cầu.");
                    break;
                }
                const typeName = item.contentSummary ? item.contentSummary.typeName : "";
                if (typeName === "lecture") {
                    log(`[${++count}/${items.length}] 🎬 Video: ${item.name}`);
                    await this.watchItem(item);
                } else if (typeName === "supplement") {
                    log(`[${++count}/${items.length}] 📖 Reading: ${item.name}`);
                    await this.readItem(item.id);
                }

                // Delay between items based on mode
                if (this.mode === 'safe') {
                    const jitter = 2000 + Math.floor(Math.random() * 3000); // 2 - 5s
                    await new Promise(r => setTimeout(r, jitter));
                } else {
                    await new Promise(r => setTimeout(r, 400));
                }
            }

            if (!this.isStopped) {
                log("🎉 Quá trình Skip khóa học hoàn tất 100%!");
            }
            chrome.runtime.sendMessage({ action: "FINISHED" });
        } catch (err) {
            log(`❌ Lỗi khi quét khóa học: ${err.message}`);
            chrome.runtime.sendMessage({ action: "FINISHED" });
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
    }

    // --- AUTO DISCUSSION ---
    async autoFillDiscussion() {
        const editor = document.querySelector('div[data-slate-editor="true"]') || document.querySelector('div[role="textbox"]') || document.querySelector('textarea');
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
    }

    // --- AUTO DO QUIZ (BATCH AI CALL) ---
    async autoDoQuiz(provider, apiKey) {
        log(`🧠 Bắt đầu quét câu hỏi đề thi...`);
        const questions = extractQuizQuestions();

        if (questions.length === 0) {
            log("❌ Không tìm thấy câu hỏi trắc nghiệm nào trên trang hiện tại!");
            return;
        }

        log(`📝 Tìm thấy ${questions.length} câu hỏi. Đang tạo Batch Prompt gửi lên ${provider.toUpperCase()}...`);
        const prompt = generateQuizPrompt(questions);

        try {
            let aiResponseJson = null;

            if (provider === 'gemini') {
                // FIXED: using gemini-2.0-flash (fast, highly accurate, free)
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
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
                if (!res.ok) throw new Error(json.error?.message || "Gemini API Error");
                const text = json.candidates[0].content.parts[0].text;
                aiResponseJson = extractJsonFromText(text);

            } else if (provider === 'groq') {
                // ADDED: Groq Llama 3.3 70B (free, sub-second response)
                const url = `https://api.groq.com/openai/v1/chat/completions`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "llama-3.3-70b-versatile",
                        messages: [
                            { role: "system", content: "You are an expert academic assistant solving Coursera quizzes with 100% accuracy. Respond only with JSON." },
                            { role: "user", content: prompt }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.1
                    })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error?.message || "Groq API Error");
                aiResponseJson = extractJsonFromText(json.choices[0].message.content);

            } else if (provider === 'openai') {
                // OpenAI GPT-4o Mini
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
                aiResponseJson = extractJsonFromText(json.choices[0].message.content);
            }

            if (!aiResponseJson) {
                throw new Error("Không thể phân tích dữ liệu JSON trả về từ AI.");
            }

            log("🎯 Đã nhận đáp án từ AI! Tiến hành tích chọn trên giao diện bài thi...");
            const filled = applyQuizAnswers(aiResponseJson, questions);
            log(`🎉 Hoàn thành! Đã tự động điền đáp án cho ${filled} lựa chọn.`);
            chrome.runtime.sendMessage({ action: "FINISHED" });

        } catch (e) {
            log(`❌ Lỗi gọi AI: ${e.message}`);
            chrome.runtime.sendMessage({ action: "FINISHED" });
        }
    }

    // --- ZERO-KEY MODE: COPY PROMPT ---
    async copyQuizPrompt() {
        log("📋 Đang cào toàn bộ câu hỏi đề thi...");
        const questions = extractQuizQuestions();

        if (questions.length === 0) {
            log("❌ Không tìm thấy câu hỏi nào! Hãy đảm bảo bạn đang ở trang bài thi (Quiz Attempt).");
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
    }

    // --- ZERO-KEY MODE: APPLY JSON ANSWERS ---
    applyAnswersFromJson(jsonString) {
        try {
            const parsed = extractJsonFromText(jsonString);
            if (!parsed) {
                log("❌ Chuỗi JSON không hợp lệ! Hãy chắc chắn bạn đã copy đúng định dạng từ AI.");
                return;
            }

            const questions = extractQuizQuestions();
            const count = applyQuizAnswers(parsed, questions);
            log(`🎉 Đã điền thành công ${count} đáp án từ kết quả JSON của bạn!`);
        } catch (e) {
            log(`❌ Lỗi áp dụng JSON: ${e.message}`);
        }
    }
}

// ============================================================
// MESSAGE LISTENER (From Popup)
// ============================================================

function getSlugFromUrl(url) {
    const match = url.match(/learn\/([^\/]+)/);
    return match ? match[1] : null;
}

let activeSkipper = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SKIPPING") {
        const slug = getSlugFromUrl(window.location.href);
        if (!slug) {
            log("❌ Không nhận diện được slug khóa học. Hãy mở trang chủ khóa học (/home/welcome hoặc /home/week/1)!");
            sendResponse({ status: "error" });
            return;
        }
        activeSkipper = new SkiperaJS(request.mode || 'safe');
        activeSkipper.getUserId().then(success => {
            if (success) {
                activeSkipper.getCourse(slug);
            } else {
                log("❌ Không lấy được User ID. Hãy chắc chắn bạn đã đăng nhập Coursera!");
            }
        });
        sendResponse({ status: "started" });
    } else if (request.action === "STOP_SKIPPING") {
        if (activeSkipper) {
            activeSkipper.stop();
            sendResponse({ status: "stopped" });
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
    }
    return true;
});
