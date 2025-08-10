import { 
    getSubjects, 
    getQuestions, 
    getQuestionById,
    addQuestion, 
    updateQuestion, 
    deleteQuestion,
    addSubject,
    deleteSubject,
    showNotification,
    isAdminLoggedIn
} from './firebase.js';

// DOM元素引用
const elements = {
    questionListTab: document.getElementById('questionListTab'),
    subjectListTab: document.getElementById('subjectListTab'),
    addQuestionTab: document.getElementById('addQuestionTab'),
    questionListContent: document.getElementById('questionListContent'),
    subjectListContent: document.getElementById('subjectListContent'),
    addQuestionContent: document.getElementById('addQuestionContent'),
    questionsTableBody: document.getElementById('questionsTableBody'),
    searchQuestions: document.getElementById('searchQuestions'),
    questionForm: document.getElementById('questionForm'),
    questionId: document.getElementById('questionId'),
    questionSubject: document.getElementById('questionSubject'),
    questionDifficulty: document.getElementById('questionDifficulty'),
    questionText: document.getElementById('questionText'),
    questionTime: document.getElementById('questionTime'),
    questionKeywords: document.getElementById('questionKeywords'),
    questionClues: document.getElementById('questionClues'),
    questionAnswer: document.getElementById('questionAnswer'),
    questionTextbook: document.getElementById('questionTextbook'),
    knowledgeTitle: document.getElementById('knowledgeTitle'),
    knowledgeContent: document.getElementById('knowledgeContent'),
    relatedQuestions: document.getElementById('relatedQuestions'),
    cancelQuestionBtn: document.getElementById('cancelQuestionBtn'),
    subjectList: document.getElementById('subjectList'),
    newSubjectName: document.getElementById('newSubjectName'),
    newSubjectColor: document.getElementById('newSubjectColor'),
    addSubjectBtn: document.getElementById('addSubjectBtn')
};

// 当前编辑的题目ID
let currentQuestionId = null;
let adminPassword = null; // 临时存储管理员密码用于操作验证

// 初始化管理员功能
function initAdmin() {
    // 只有管理员才能初始化管理功能
    if (!isAdminLoggedIn()) return;
    
    // 绑定事件监听器
    bindEvents();
    
    // 加载初始数据
    loadAdminData();
}

// 绑定事件监听器
function bindEvents() {
    // 标签页切换
    elements.questionListTab.addEventListener('click', switchToQuestionListTab);
    elements.subjectListTab.addEventListener('click', switchToSubjectListTab);
    elements.addQuestionTab.addEventListener('click', switchToAddQuestionTab);
    
    // 搜索题目
    elements.searchQuestions.addEventListener('input', debounce(function() {
        window.db.updateAdminTables(); // 调用firebase.js中的更新函数
    }, 300));
    
    // 表单提交
    elements.questionForm.addEventListener('submit', function(e) {
        e.preventDefault();
        saveQuestion();
    });
    
    // 取消按钮
    elements.cancelQuestionBtn.addEventListener('click', switchToQuestionListTab);
    
    // 添加科目
    elements.addSubjectBtn.addEventListener('click', addNewSubject);
    
    // 使用事件委托绑定编辑、删除按钮和删除科目按钮
    elements.questionsTableBody.addEventListener('click', handleQuestionTableAction);
    elements.subjectList.addEventListener('click', handleSubjectListAction);
}

// 加载管理员数据
function loadAdminData() {
    // 数据加载由firebase.js中的updateAdminUI触发
    showNotification("管理员功能已加载", "success");
}

// 切换到题目列表标签
function switchToQuestionListTab() {
    // 更新标签样式
    updateTabStyles(elements.questionListTab, elements.subjectListTab, elements.addQuestionTab);
    
    // 显示内容
    elements.questionListContent.classList.remove('hidden');
    elements.subjectListContent.classList.add('hidden');
    elements.addQuestionContent.classList.add('hidden');
    
    // 刷新题目列表
    window.db.updateAdminTables();
}

// 切换到科目列表标签
function switchToSubjectListTab() {
    // 更新标签样式
    updateTabStyles(elements.subjectListTab, elements.questionListTab, elements.addQuestionTab);
    
    // 显示内容
    elements.questionListContent.classList.add('hidden');
    elements.subjectListContent.classList.remove('hidden');
    elements.addQuestionContent.classList.add('hidden');
    
    // 刷新科目列表
    window.db.updateAdminSubjectList();
}

// 切换到添加题目标签
function switchToAddQuestionTab() {
    // 更新标签样式
    updateTabStyles(elements.addQuestionTab, elements.questionListTab, elements.subjectListTab);
    
    // 显示内容
    elements.questionListContent.classList.add('hidden');
    elements.subjectListContent.classList.add('hidden');
    elements.addQuestionContent.classList.remove('hidden');
    
    // 重置表单（优化点：确保添加新题目时表单为空）
    resetForm();
    
    // 更新科目选项
    window.db.updateQuestionSubjectOptions();
}

// 更新标签样式
function updateTabStyles(activeTab, ...inactiveTabs) {
    // 设置活动标签样式
    activeTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    activeTab.classList.remove('text-gray-500');
    
    // 设置非活动标签样式
    inactiveTabs.forEach(tab => {
        tab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        tab.classList.add('text-gray-500');
    });
}

// 处理题目表格操作（编辑/删除）
function handleQuestionTableAction(e) {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');
    
    if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        editQuestion(id);
    } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        confirmDeleteQuestion(id);
    }
}

// 处理科目列表操作（删除）
function handleSubjectListAction(e) {
    const deleteBtn = e.target.closest('.delete-subject-btn');
    if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        confirmDeleteSubject(id);
    }
}

// 编辑题目
async function editQuestion(id) {
    try {
        // 获取题目数据
        const question = await getQuestionById(id);
        if (!question) {
            showNotification("未找到该题目", "error");
            return;
        }
        
        currentQuestionId = id;
        
        // 填充表单
        elements.questionId.value = question.id;
        elements.questionSubject.value = question.subject;
        elements.questionDifficulty.value = question.difficulty;
        elements.questionText.value = question.question;
        elements.questionTime.value = question.time;
        elements.questionKeywords.value = question.keywords.join(', ');
        elements.questionClues.value = question.clues.join('\n');
        elements.questionAnswer.value = question.answer;
        elements.questionTextbook.value = question.textbook;
        elements.knowledgeTitle.value = question.knowledge.title;
        elements.knowledgeContent.value = question.knowledge.content;
        elements.relatedQuestions.value = question.knowledge.relatedQuestions.join('\n');
        
        // 切换到添加/编辑标签
        switchToAddQuestionTab();
        
        // 提示用户输入密码进行验证
        promptAdminPassword();
    } catch (error) {
        console.error("编辑题目失败:", error);
        showNotification("编辑题目失败，请重试", "error");
    }
}

// 确认删除题目
function confirmDeleteQuestion(id) {
    if (confirm('确定要删除这个题目吗？此操作不可撤销。')) {
        // 提示用户输入密码进行验证
        promptAdminPassword(() => {
            deleteQuestion(id);
        });
    }
}

// 删除题目
async function deleteQuestion(id) {
    if (!adminPassword) {
        showNotification("请先验证管理员密码", "error");
        return;
    }
    
    try {
        const success = await deleteQuestion(id, adminPassword);
        if (success) {
            // 刷新题目列表
            window.db.updateAdminTables();
        }
    } catch (error) {
        console.error("删除题目失败:", error);
        showNotification("删除题目失败，请重试", "error");
    }
}

// 保存题目
async function saveQuestion() {
    if (!adminPassword) {
        showNotification("请先验证管理员密码", "error");
        promptAdminPassword(() => saveQuestion());
        return;
    }
    
    // 获取表单数据
    const formData = {
        id: elements.questionId.value,
        subject: elements.questionSubject.value,
        difficulty: elements.questionDifficulty.value,
        question: elements.questionText.value,
        time: elements.questionTime.value,
        keywords: elements.questionKeywords.value.split(',').map(k => k.trim()).filter(k => k),
        clues: elements.questionClues.value.split('\n').filter(c => c.trim() !== ''),
        answer: elements.questionAnswer.value,
        textbook: elements.questionTextbook.value,
        knowledge: {
            title: elements.knowledgeTitle.value,
            content: elements.knowledgeContent.value,
            relatedQuestions: elements.relatedQuestions.value.split('\n').filter(q => q.trim() !== '')
        }
    };
    
    // 验证表单数据
    if (!validateFormData(formData)) {
        return;
    }
    
    try {
        let success;
        
        // 保存题目（新增或更新）
        if (formData.id) {
            // 更新现有题目
            success = await updateQuestion(formData, adminPassword);
        } else {
            // 添加新题目
            const newQuestion = await addQuestion(formData, adminPassword);
            success = !!newQuestion;
        }
        
        // 保存成功后切换到题目列表
        if (success) {
            switchToQuestionListTab();
        }
    } catch (error) {
        console.error("保存题目失败:", error);
        showNotification("保存题目失败，请重试", "error");
    }
}

// 验证表单数据
function validateFormData(data) {
    if (!data.subject) {
        showNotification('请选择学科', 'error');
        return false;
    }
    
    if (!data.difficulty) {
        showNotification('请选择难度', 'error');
        return false;
    }
    
    if (!data.question.trim()) {
        showNotification('请输入谜题描述', 'error');
        return false;
    }
    
    // 验证time字段（转换为数字）
    if (!data.time || isNaN(parseInt(data.time)) || parseInt(data.time) <= 0) {
        showNotification('请输入有效的建议用时', 'error');
        return false;
    }
    
    if (data.keywords.length === 0) {
        showNotification('请输入有效的关键词（至少一个）', 'error');
        return false;
    }
    
    if (data.clues.length < 3) {
        showNotification('请至少输入3条线索', 'error');
        return false;
    }
    
    if (!data.answer.trim()) {
        showNotification('请输入答案', 'error');
        return false;
    }
    
    if (!data.textbook.trim()) {
        showNotification('请输入关联教材', 'error');
        return false;
    }
    
    if (!data.knowledge.title.trim()) {
        showNotification('请输入知识点标题', 'error');
        return false;
    }
    
    if (!data.knowledge.content.trim()) {
        showNotification('请输入知识点解析', 'error');
        return false;
    }
    
    if (data.knowledge.relatedQuestions.length < 2) {
        showNotification('请至少输入2个相关问题', 'error');
        return false;
    }
    
    return true;
}

// 重置表单
function resetForm() {
    elements.questionForm.reset();
    elements.questionId.value = '';
    currentQuestionId = null;
    adminPassword = null; // 清除密码缓存
}

// 添加新科目
async function addNewSubject() {
    const subjectName = elements.newSubjectName.value.trim();
    const subjectColor = elements.newSubjectColor.value;
    
    if (!subjectName) {
        showNotification('请输入科目名称', 'error');
        return;
    }
    
    // 提示用户输入密码进行验证
    promptAdminPassword(() => {
        doAddSubject(subjectName, subjectColor);
    });
}

// 执行添加科目操作
async function doAddSubject(name, color) {
    if (!adminPassword) {
        showNotification("请先验证管理员密码", "error");
        return;
    }
    
    try {
        const success = await addSubject({ name, color }, adminPassword);
        if (success) {
            // 清空输入框
            elements.newSubjectName.value = '';
            // 刷新科目列表
            window.db.updateAdminSubjectList();
        }
    } catch (error) {
        console.error("添加科目失败:", error);
        showNotification("添加科目失败，请重试", "error");
    }
}

// 确认删除科目
function confirmDeleteSubject(id) {
    const subject = window.db.localCache.subjects[id];
    if (!subject) return;
    
    if (confirm(`确定要删除"${subject.name}"科目吗？此操作不可撤销。`)) {
        // 提示用户输入密码进行验证
        promptAdminPassword(() => {
            deleteSubject(id);
        });
    }
}

// 删除科目
async function deleteSubject(id) {
    if (!adminPassword) {
        showNotification("请先验证管理员密码", "error");
        return;
    }
    
    try {
        const success = await deleteSubject(id, adminPassword);
        if (success) {
            // 刷新科目列表
            window.db.updateAdminSubjectList();
        }
    } catch (error) {
        console.error("删除科目失败:", error);
        showNotification("删除科目失败，请重试", "error");
    }
}

// 提示输入管理员密码
function promptAdminPassword(callback) {
    if (adminPassword) {
        // 已经验证过密码，直接执行回调
        callback && callback();
        return;
    }
    
    const password = prompt('请输入管理员密码以执行操作：');
    if (password === null) {
        // 用户取消
        showNotification("操作已取消", "info");
        return;
    }
    
    // 简单验证密码格式（非空）
    if (!password.trim()) {
        showNotification("密码不能为空", "error");
        return;
    }
    
    // 暂存密码用于后续操作
    adminPassword = password;
    
    // 执行回调
    callback && callback();
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 当DOM加载完成且用户是管理员时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 等待firebase初始化完成
    const checkAdminStatus = setInterval(() => {
        if (window.db && window.db.isAdminLoggedIn()) {
            initAdmin();
            clearInterval(checkAdminStatus);
        }
    }, 300);
});
