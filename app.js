import { 
    getSubjects, 
    getQuestionsBySubjectAndDifficulty,
    showNotification,
    onDataChange,
    isAdminLoggedIn,
    adminLogout
} from './firebase.js';
import { handleUserQuestion, checkAnswerSimilarity } from './question-handler.js';

// DOM元素引用
const elements = {
    subjectSelection: document.getElementById('subjectSelection'),
    difficultySelection: document.getElementById('difficultySelection'),
    gameArea: document.getElementById('gameArea'),
    answerSection: document.getElementById('answerSection'),
    subjectGrid: document.getElementById('subjectGrid'),
    difficultyButtons: document.getElementById('difficultyButtons'),
    soupQuestion: document.getElementById('soupQuestion'),
    soupTime: document.getElementById('soupTime'),
    chatHistory: document.getElementById('chatHistory'),
    userQuestion: document.getElementById('userQuestion'),
    sendQuestion: document.getElementById('sendQuestion'),
    guessAnswer: document.getElementById('guessAnswer'),
    soupAnswer: document.getElementById('soupAnswer'),
    soupTextbook: document.getElementById('soupTextbook'),
    knowledgeTitle: document.getElementById('knowledgeTitle'),
    knowledgeContent: document.getElementById('knowledgeContent'),
    relatedQuestions: document.getElementById('relatedQuestions'),
    playAgain: document.getElementById('playAgain'),
    backToDifficulty: document.getElementById('backToDifficulty'),
    loginBtn: document.getElementById('loginBtn'),
    loginModal: document.getElementById('loginModal'),
    loginModalContent: document.getElementById('loginModalContent'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    adminPassword: document.getElementById('adminPassword'),
    loginError: document.getElementById('loginError'),
    closeLoginModal: document.getElementById('closeLoginModal'),
    guessModal: document.getElementById('guessModal'),
    guessModalContent: document.getElementById('guessModalContent'),
    guessForm: document.getElementById('guessForm'),
    userGuess: document.getElementById('userGuess'),
    closeGuessModal: document.getElementById('closeGuessModal')
};

// 当前状态
let currentSubject = null;
let currentDifficulty = null;
let currentSoup = null;
let isProcessingQuestion = false; // 防止重复提交
let unsubscribeDataChange = null;

// 初始化应用
function initApp() {
    // 绑定事件监听器
    bindEvents();
    
    // 监听数据变化
    unsubscribeDataChange = onDataChange(() => {
        // 数据变化时更新UI
        if (!currentSubject && !currentDifficulty && !currentSoup) {
            loadSubjects();
        }
    });
    
    // 加载学科
    loadSubjects();
}

// 绑定事件监听器
function bindEvents() {
    // 学科卡片点击事件委托
    elements.subjectGrid.addEventListener('click', function(e) {
        const subjectCard = e.target.closest('.subject-card');
        if (subjectCard) {
            selectSubject(subjectCard.dataset.id);
        }
    });
    
    // 难度按钮点击事件委托
    elements.difficultyButtons.addEventListener('click', function(e) {
        const difficultyBtn = e.target.closest('.difficulty-btn');
        if (difficultyBtn) {
            selectDifficulty(difficultyBtn.dataset.difficulty);
        }
    });
    
    // 发送问题
    elements.sendQuestion.addEventListener('click', sendUserQuestion);
    elements.userQuestion.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendUserQuestion();
    });
    
    // 猜答案
    elements.guessAnswer.addEventListener('click', openGuessModal);
    
    // 再玩一次
    elements.playAgain.addEventListener('click', resetGame);
    
    // 返回难度选择
    elements.backToDifficulty.addEventListener('click', backToDifficultySelection);
    
    // 管理员登录按钮
    elements.loginBtn.addEventListener('click', toggleAdminLogin);
    
    // 关闭登录模态框
    elements.closeLoginModal.addEventListener('click', closeLoginModal);
    
    // 管理员登录表单提交
    elements.adminLoginForm.addEventListener('submit', handleAdminLogin);
    
    // 猜答案表单提交
    elements.guessForm.addEventListener('submit', handleGuessAnswer);
    
    // 关闭猜答案模态框
    elements.closeGuessModal.addEventListener('click', closeGuessModal);
    
    // 窗口关闭时取消监听
    window.addEventListener('beforeunload', () => {
        if (unsubscribeDataChange) {
            unsubscribeDataChange();
        }
    });
}

// 加载学科
async function loadSubjects() {
    try {
        const subjects = await getSubjects();
        
        // 如果已经有学科卡片则不重复添加
        if (Object.keys(subjects).length > 0 && elements.subjectGrid.children.length > 0) {
            return;
        }
        
        // 学科加载成功后的UI更新由firebase.js中的updateSubjectUI处理
    } catch (error) {
        console.error("加载学科失败:", error);
        showNotification("加载学科失败，请刷新页面重试", "error");
    }
}

// 选择学科
function selectSubject(subjectId) {
    // 移除所有卡片的active状态
    document.querySelectorAll('.subject-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // 添加当前卡片的active状态
    const currentCard = document.querySelector(`.subject-card[data-id="${subjectId}"]`);
    if (currentCard) {
        currentCard.classList.add('active');
    }
    
    currentSubject = subjectId;
    
    // 显示难度选择
    elements.subjectSelection.classList.add('hidden');
    elements.difficultySelection.classList.remove('hidden');
    elements.difficultySelection.classList.add('scale-in');
}

// 选择难度
async function selectDifficulty(difficulty) {
    // 移除所有难度按钮的active状态
    elements.difficultyButtons.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 添加当前按钮的active状态
    const currentBtn = elements.difficultyButtons.querySelector(`.difficulty-btn[data-difficulty="${difficulty}"]`);
    if (currentBtn) {
        currentBtn.classList.add('active');
    }
    
    currentDifficulty = difficulty;
    
    // 显示加载状态
    showNotification("正在加载题目...", "info");
    
    try {
        // 获取该学科和难度的题目
        const questions = await getQuestionsBySubjectAndDifficulty(currentSubject, currentDifficulty);
        
        if (questions.length === 0) {
            showNotification("该学科该难度下暂无题目", "error");
            return;
        }
        
        // 随机选择一个题目
        currentSoup = questions[Math.floor(Math.random() * questions.length)];
        
        // 显示游戏区
        elements.difficultySelection.classList.add('hidden');
        elements.gameArea.classList.remove('hidden');
        elements.gameArea.classList.add('scale-in');
        
        // 初始化游戏区
        initGameArea();
        
        showNotification("题目加载成功，可以开始提问了", "success");
    } catch (error) {
        console.error("加载题目失败:", error);
        showNotification("加载题目失败，请重试", "error");
    }
}

// 初始化游戏区
function initGameArea() {
    // 显示谜题
    elements.soupQuestion.textContent = currentSoup.question;
    elements.soupTime.textContent = currentSoup.time;
    
    // 清空聊天记录
    elements.chatHistory.innerHTML = '';
    
    // 添加初始消息
    addSystemMessage("欢迎来到海龟汤游戏！你可以向我提问，我会回答是、否或无关。当你想猜答案时，请点击"猜答案"按钮。");
}

// 发送用户问题
async function sendUserQuestion() {
    const question = elements.userQuestion.value.trim();
    
    if (!question) {
        showNotification("请输入问题", "warning");
        return;
    }
    
    if (isProcessingQuestion) {
        showNotification("正在处理你的问题，请稍候...", "info");
        return;
    }
    
    // 添加用户消息到聊天记录
    addUserMessage(question);
    
    // 清空输入框
    elements.userQuestion.value = '';
    
    // 标记为正在处理
    isProcessingQuestion = true;
    elements.sendQuestion.disabled = true;
    elements.sendQuestion.textContent = '处理中...';
    
    try {
        // 模拟思考时间（300-800ms）
        const thinkTime = Math.floor(Math.random() * 500) + 300;
        await new Promise(resolve => setTimeout(resolve, thinkTime));
        
        // 处理问题
        const answer = await handleUserQuestion(question, currentSoup);
        
        // 添加系统回复
        addSystemMessage(answer);
    } catch (error) {
        console.error("处理问题失败:", error);
        addSystemMessage("抱歉，处理你的问题时出错了，请重试。");
    } finally {
        // 恢复状态
        isProcessingQuestion = false;
        elements.sendQuestion.disabled = false;
        elements.sendQuestion.textContent = '发送';
    }
}

// 添加用户消息
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.textContent = text;
    elements.chatHistory.appendChild(messageDiv);
    scrollToBottom();
}

// 添加系统消息
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.textContent = text;
    elements.chatHistory.appendChild(messageDiv);
    scrollToBottom();
}

// 滚动到聊天底部
function scrollToBottom() {
    elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

// 打开猜答案模态框
function openGuessModal() {
    elements.guessModal.classList.remove('hidden');
    elements.guessModal.classList.add('active');
    elements.userGuess.focus();
}

// 关闭猜答案模态框
function closeGuessModal() {
    elements.guessModal.classList.remove('active');
    setTimeout(() => {
        elements.guessModal.classList.add('hidden');
        elements.guessForm.reset();
    }, 300);
}

// 处理猜答案
function handleGuessAnswer(e) {
    e.preventDefault();
    
    const userAnswer = elements.userGuess.value.trim();
    
    if (!userAnswer) {
        showNotification("请输入答案", "warning");
        return;
    }
    
    // 检查答案相似度
    const isCorrect = checkAnswerSimilarity(userAnswer, currentSoup);
    
    closeGuessModal();
    
    if (isCorrect) {
        showNotification("恭喜你，猜对了！", "success");
        showAnswerSection();
    } else {
        showNotification("很遗憾，猜错了，请继续提问或再试一次", "error");
        addSystemMessage("猜错了，请继续提问或再试一次。");
    }
}

// 显示答案区域
function showAnswerSection() {
    // 填充答案内容
    elements.soupAnswer.textContent = currentSoup.answer;
    elements.soupTextbook.textContent = currentSoup.textbook;
    elements.knowledgeTitle.textContent = currentSoup.knowledge.title;
    elements.knowledgeContent.textContent = currentSoup.knowledge.content;
    
    // 填充相关问题
    elements.relatedQuestions.innerHTML = '';
    currentSoup.knowledge.relatedQuestions.forEach(question => {
        const li = document.createElement('li');
        li.textContent = question;
        elements.relatedQuestions.appendChild(li);
    });
    
    // 显示答案区
    elements.gameArea.classList.add('hidden');
    elements.answerSection.classList.remove('hidden');
    elements.answerSection.classList.add('scale-in');
}

// 重置游戏
function resetGame() {
    currentSubject = null;
    currentDifficulty = null;
    currentSoup = null;
    
    elements.answerSection.classList.add('hidden');
    elements.subjectSelection.classList.remove('hidden');
    elements.subjectSelection.classList.add('scale-in');
}

// 返回难度选择
function backToDifficultySelection() {
    currentDifficulty = null;
    currentSoup = null;
    
    elements.gameArea.classList.add('hidden');
    elements.difficultySelection.classList.remove('hidden');
    elements.difficultySelection.classList.add('scale-in');
}

// 切换管理员登录状态
function toggleAdminLogin() {
    if (isAdminLoggedIn()) {
        // 登出
        if (confirm('确定要退出管理员模式吗？')) {
            adminLogout();
            showNotification("已退出管理员模式", "info");
        }
    } else {
        // 登录
        openLoginModal();
    }
}

// 打开登录模态框
function openLoginModal() {
    elements.loginModal.classList.remove('hidden');
    elements.loginModal.classList.add('active');
    elements.adminPassword.focus();
    elements.loginError.classList.add('hidden');
}

// 关闭登录模态框
function closeLoginModal() {
    elements.loginModal.classList.remove('active');
    setTimeout(() => {
        elements.loginModal.classList.add('hidden');
        elements.adminLoginForm.reset();
        elements.loginError.classList.add('hidden');
    }, 300);
}

// 处理管理员登录
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const password = elements.adminPassword.value.trim();
    
    if (!password) {
        showLoginError("请输入管理员密码");
        return;
    }
    
    // 禁用登录按钮
    const submitBtn = elements.adminLoginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';
    
    try {
        // 验证管理员密码
        const success = await window.db.adminLogin(password);
        
        if (success) {
            closeLoginModal();
            showNotification("管理员登录成功", "success");
        } else {
            showLoginError("密码错误，请重试");
        }
    } catch (error) {
        console.error("管理员登录失败:", error);
        showLoginError("登录失败，请重试");
    } finally {
        // 恢复按钮状态
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
    }
}

// 显示登录错误
function showLoginError(message) {
    elements.loginError.textContent = message;
    elements.loginError.classList.remove('hidden');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        elements.loginError.classList.add('hidden');
    }, 3000);
}

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);
