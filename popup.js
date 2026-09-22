document.addEventListener('DOMContentLoaded', function () {
    // --- Elements ---
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const auditBtn = document.getElementById('auditBtn');
    const getCertBtn = document.getElementById('getCertBtn');
    const discussionBtn = document.getElementById('discussionBtn');
    const gradePeerBtn = document.getElementById('gradePeerBtn');
    const doAssignmentBtn = document.getElementById('doAssignmentBtn');
    const doQuizBtn = document.getElementById('doQuizBtn');
    const copyQuizBtn = document.getElementById('copyQuizBtn');
    const applyJsonBtn = document.getElementById('applyJsonBtn');
    const jsonInput = document.getElementById('jsonInput');
    const aiProviderSelect = document.getElementById('aiProvider');
    const apiKeyInput = document.getElementById('apiKey');
    const getKeyLink = document.getElementById('getKeyLink');
    const keyHint = document.getElementById('keyHint');
    const gradeCountInput = document.getElementById('gradeCount');
    const logDiv = document.getElementById('log');
    const clearLogBtn = document.getElementById('clearLogBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const tickerMsg = document.getElementById('tickerMsg');
    const quizApiSection = document.getElementById('quizApiSection');
    const quizManualSection = document.getElementById('quizManualSection');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressLabel = document.getElementById('progressLabel');
    const certBanner = document.getElementById('certBanner');
    const certStudentName = document.getElementById('certStudentName');
    const certUrlInput = document.getElementById('certUrlInput');
    const copyCertBtn = document.getElementById('copyCertBtn');

    // --- Theme Switcher Logic (Emerald, Cyan, Amber, Nordic) ---
    function applyTheme(themeName) {
        const validTheme = ['emerald', 'cyan', 'amber', 'nordic'].includes(themeName) ? themeName : 'cyan';
        document.documentElement.setAttribute('data-theme', validTheme);
        document.querySelectorAll('.theme-dot').forEach(dot => {
            if (dot.getAttribute('data-theme') === validTheme) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const theme = dot.getAttribute('data-theme');
            applyTheme(theme);
            chrome.storage.local.set({ 'app_theme': theme });
        });
    });

    chrome.storage.local.get(['app_theme'], (data) => {
        applyTheme(data.app_theme || 'cyan');
    });

    // --- Helper to show certificate banner ---
    function showCertBanner(url, name) {
        if (!certBanner) return;
        certBanner.style.display = 'block';
        if (certStudentName) certStudentName.textContent = name || "Học viên Coursera";
        if (certUrlInput) certUrlInput.value = url;
    }

    // Load cached cert if exists
    chrome.storage.local.get(['savedCertUrl', 'savedCertName'], (res) => {
        if (res.savedCertUrl) {
            showCertBanner(res.savedCertUrl, res.savedCertName || "Học viên Coursera");
        }
    });

    // --- Provider Meta ---
    const PROVIDER_INFO = {
        'gemini': {
            url: 'https://aistudio.google.com/app/apikey',
            hint: 'Google AI Studio (Miễn phí)',
            placeholder: 'Dán Gemini API Key...'
        },
        'groq': {
            url: 'https://console.groq.com/keys',
            hint: 'Groq Cloud Console (Miễn phí, Llama 3.3)',
            placeholder: 'Dán Groq API Key (gsk_...)'
        },
        'openai': {
            url: 'https://platform.openai.com/api-keys',
            hint: 'OpenAI Developer Console',
            placeholder: 'Dán OpenAI API Key (sk-...)'
        }
    };

    // --- Tab Switching ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const panel = document.getElementById(target);
            if (panel) panel.classList.add('active');
        });
    });

    // --- Quiz Method Switching (API vs Manual) ---
    document.querySelectorAll('input[name="quizMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'api') {
                quizApiSection.style.display = 'block';
                quizManualSection.style.display = 'none';
            } else {
                quizApiSection.style.display = 'none';
                quizManualSection.style.display = 'block';
            }
        });
    });

    // --- Load Saved Settings ---
    chrome.storage.local.get(['aiProvider', 'apiKey_gemini', 'apiKey_groq', 'apiKey_openai', 'farmMode', 'gradeCount'], (result) => {
        if (result.aiProvider && aiProviderSelect) {
            aiProviderSelect.value = result.aiProvider;
        }
        if (result.farmMode) {
            const radio = document.querySelector(`input[name="farmMode"][value="${result.farmMode}"]`);
            if (radio) radio.checked = true;
        }
        if (result.gradeCount && gradeCountInput) {
            gradeCountInput.value = result.gradeCount;
        }
        updateProviderUI(aiProviderSelect ? aiProviderSelect.value : 'gemini', result);
    });

    function updateProviderUI(provider, savedData = {}) {
        const info = PROVIDER_INFO[provider] || PROVIDER_INFO['gemini'];
        if (getKeyLink) getKeyLink.href = info.url;
        if (keyHint) keyHint.textContent = info.hint;
        if (apiKeyInput) apiKeyInput.placeholder = info.placeholder;

        const keyProp = `apiKey_${provider}`;
        if (savedData[keyProp] !== undefined) {
            if (apiKeyInput) apiKeyInput.value = savedData[keyProp];
        } else {
            chrome.storage.local.get([keyProp], (res) => {
                if (apiKeyInput) apiKeyInput.value = res[keyProp] || '';
            });
        }
    }

    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', () => {
            const provider = aiProviderSelect.value;
            chrome.storage.local.set({ aiProvider: provider });
            updateProviderUI(provider);
        });
    }

    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
            const provider = aiProviderSelect ? aiProviderSelect.value : 'gemini';
            const obj = {};
            obj[`apiKey_${provider}`] = apiKeyInput.value.trim();
            chrome.storage.local.set(obj);
        });
    }

    document.querySelectorAll('input[name="farmMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            chrome.storage.local.set({ farmMode: radio.value });
        });
    });

    if (gradeCountInput) {
        gradeCountInput.addEventListener('change', () => {
            chrome.storage.local.set({ gradeCount: gradeCountInput.value });
        });
    }

    function getSelectedFarmMode() {
        const checked = document.querySelector('input[name="farmMode"]:checked');
        return checked ? checked.value : 'safe';
    }

    // --- Logging & Status ---
    function setRunningState(isRunning, customStatus = "") {
        if (startBtn) startBtn.disabled = isRunning;
        if (stopBtn) stopBtn.disabled = !isRunning;

        if (statusDot) {
            if (isRunning) {
                statusDot.className = "status-dot running";
                if (statusText) statusText.textContent = customStatus || "Đang xử lý...";
            } else {
                statusDot.className = "status-dot";
                if (statusText) statusText.textContent = "Sẵn sàng";
            }
        }
    }

    function log(msg) {
        if (!logDiv) return;
        const p = document.createElement('div');
        const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        p.innerHTML = `<span class="terminal-time">[${time}]</span> ${msg}`;
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight;

        if (tickerMsg) {
            tickerMsg.textContent = msg.replace(/<[^>]*>?/gm, '');
        }
    }

    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (logDiv) logDiv.innerHTML = '';
        });
    }

    async function getActiveCourseraTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.includes("coursera.org")) {
            switchToTab('tab-log');
            log("❌ Bạn cần mở một tab khóa học trên Coursera!");
            return null;
        }
        return tab;
    }

    // --- 1. SKIP VIDEOS & READING ---
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            const mode = getSelectedFarmMode();
            setRunningState(true, mode === 'safe' ? "Safe Farm" : "Turbo");
            log(`🚀 Khởi động quét khóa học (${mode === 'safe' ? 'Chế độ an toàn' : 'Chế độ Turbo'})...`);

            chrome.tabs.sendMessage(tab.id, { action: "START_SKIPPING", mode: mode }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Kết nối thất bại: Hãy F5 lại trang Coursera và thử lại!");
                    setRunningState(false);
                } else {
                    log("Đang tải dữ liệu bài học qua API...");
                }
            });
        });
    }

    // --- 2. STOP ---
    if (stopBtn) {
        stopBtn.addEventListener('click', async () => {
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            log("Yêu cầu dừng tiến trình...");
            stopBtn.disabled = true;

            chrome.tabs.sendMessage(tab.id, { action: "STOP_SKIPPING" }, (response) => {
                if (chrome.runtime.lastError) {
                    log("Lỗi: " + chrome.runtime.lastError.message);
                } else {
                    log("⏹ Đã dừng.");
                    setRunningState(false);
                }
            });
        });
    }

    // --- Helper to switch tabs ---
    function switchToTab(tabId) {
        const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (btn) btn.click();
    }

    // --- AUDIT COURSE PROGRESS (FIND MISSING ITEMS / FIX 99%) ---
    if (auditBtn) {
        auditBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            setRunningState(true, "Audit 99%");
            log("🔍 Đang kiểm tra tiến độ thực tế toàn bộ khóa học...");
            chrome.tabs.sendMessage(tab.id, { action: "AUDIT_COURSE" }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy mở trang chủ khóa học (/home/welcome hoặc /home/week/1) rồi thử lại.");
                    setRunningState(false);
                }
            });
        });
    }

    // --- GET CERTIFICATE & FAP LINK ---
    if (getCertBtn) {
        getCertBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            setRunningState(true, "Lấy Cert");
            log("🎓 Đang truy xuất thông tin chứng chỉ & link Verify cho FAP...");
            chrome.tabs.sendMessage(tab.id, { action: "GET_CERT_INFO" }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy mở trang khóa học trên Coursera rồi thử lại.");
                    setRunningState(false);
                }
            });
        });
    }

    // --- COPY CERTIFICATE FOR FAP ---
    if (copyCertBtn) {
        copyCertBtn.addEventListener('click', async () => {
            const url = certUrlInput ? certUrlInput.value : '';
            if (!url) return;
            try {
                await navigator.clipboard.writeText(url);
                const oldText = copyCertBtn.textContent;
                copyCertBtn.textContent = "✅ Đã Copy!";
                copyCertBtn.style.background = "#10b981";
                setTimeout(() => {
                    copyCertBtn.textContent = oldText;
                    copyCertBtn.style.background = "";
                }, 2000);
                log("📋 Đã copy link nộp FAP vào Clipboard!");
            } catch (e) {
                if (certUrlInput) {
                    certUrlInput.select();
                    document.execCommand('copy');
                    log("📋 Đã copy link vào Clipboard!");
                }
            }
        });
    }

    // --- 3. AUTO DISCUSSION ---
    if (discussionBtn) {
        discussionBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            setRunningState(true, "Discussion");
            log("💬 Đang gửi phản hồi thảo luận...");
            chrome.tabs.sendMessage(tab.id, { action: "AUTO_DISCUSSION" }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy mở đúng trang thảo luận rồi thử lại.");
                    setRunningState(false);
                }
            });
        });
    }

    // --- 4. AUTO DO ASSIGNMENT ---
    if (doAssignmentBtn) {
        doAssignmentBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            setRunningState(true, "Peer Submit");
            log("📝 Đang điền nội dung học thuật vào bài tập tự luận...");
            chrome.tabs.sendMessage(tab.id, { action: "AUTO_DO_ASSIGNMENT" }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy mở trang nộp bài tập (Submit your assignment) rồi thử lại.");
                    setRunningState(false);
                }
            });
        });
    }

    // --- 5. AUTO GRADE PEER ---
    if (gradePeerBtn) {
        gradePeerBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            const count = parseInt(gradeCountInput.value, 10) || 3;
            setRunningState(true, "Peer Grade");
            log(`⭐ Bắt đầu chấm chéo ${count} bài với điểm tối đa...`);
            chrome.tabs.sendMessage(tab.id, { action: "AUTO_GRADE_PEER", count: count }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy mở trang chấm bài (Review your peers) rồi thử lại.");
                    setRunningState(false);
                }
            });
        });
    }

    // --- 6. AUTO DO QUIZ (API MODE) ---
    if (doQuizBtn) {
        doQuizBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            const provider = aiProviderSelect.value;
            const key = apiKeyInput.value.trim();

            if (!key) {
                log("⚠️ Vui lòng nhập API Key để giải bài trắc nghiệm!");
                return;
            }

            setRunningState(true, "AI Quiz");
            log(`🧠 Đang quét và gửi toàn bộ đề thi lên ${provider.toUpperCase()}...`);
            chrome.tabs.sendMessage(tab.id, { action: "AUTO_DO_QUIZ", provider: provider, apiKey: key }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy mở trang làm bài thi (Quiz Attempt) rồi thử lại.");
                    setRunningState(false);
                } else {
                    log("🤖 [v2.3] Đang phân tích và xử lý câu hỏi...");
                }
            });
        });
    }

    // --- 7. COPY QUIZ PROMPT (ZERO-KEY MODE) ---
    if (copyQuizBtn) {
        copyQuizBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            setRunningState(true, "Cào đề");
            log("📋 Đang cào toàn bộ câu hỏi và tạo prompt chuẩn...");
            chrome.tabs.sendMessage(tab.id, { action: "COPY_QUIZ_PROMPT" }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy chắc chắn bạn đang mở trang bài thi (Quiz Attempt)!");
                    setRunningState(false);
                }
            });
        });
    }

    // --- 8. APPLY JSON ANSWERS ---
    if (applyJsonBtn) {
        applyJsonBtn.addEventListener('click', async () => {
            switchToTab('tab-log');
            const tab = await getActiveCourseraTab();
            if (!tab) return;

            const rawJson = jsonInput.value.trim();
            if (!rawJson) {
                log("⚠️ Hãy dán kết quả JSON từ ChatGPT vào ô trước!");
                return;
            }

            setRunningState(true, "Điền JSON");
            log("📥 Đang phân tích JSON và tự động tích đáp án...");
            chrome.tabs.sendMessage(tab.id, { action: "APPLY_QUIZ_ANSWERS", jsonAnswers: rawJson }, (response) => {
                if (chrome.runtime.lastError) {
                    log("❌ Hãy mở trang bài thi rồi thử lại.");
                    setRunningState(false);
                }
            });
        });
    }

    // --- Background / Content Script Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "LOG") {
            log(request.message);
        } else if (request.action === "FINISHED") {
            setRunningState(false);
            log("🏁 Tiến trình hoàn tất!");
        } else if (request.action === "PROGRESS_UPDATE") {
            if (progressContainer) {
                progressContainer.style.display = 'block';
            }
            if (progressPercent) {
                progressPercent.textContent = `${request.percent}%`;
            }
            if (progressFill) {
                progressFill.style.width = `${request.percent}%`;
            }
            if (progressLabel && request.completed !== undefined && request.total !== undefined) {
                progressLabel.textContent = `Tiến độ: ${request.completed}/${request.total} bài (${request.percent}%)`;
            }
            if (request.itemName && statusText) {
                statusText.textContent = request.itemName.length > 22 
                    ? request.itemName.substring(0, 20) + "..." 
                    : request.itemName;
            }
        } else if (request.action === "CERT_FOUND") {
            showCertBanner(request.verifyUrl, request.studentName);
            chrome.storage.local.set({
                savedCertUrl: request.verifyUrl,
                savedCertName: request.studentName
            });
        }
    });
});
