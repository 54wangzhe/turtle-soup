// 导入Firebase模块
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-analytics.js";
import { getDatabase, ref, get, set, update, remove, onValue, off } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

// 初始化Firebase（使用提供的配置）
const firebaseConfig = {
  apiKey: "AIzaSyD9HkPtNIbLGtI9rCemWeHPDarXbj9PdVo",
  authDomain: "turtlesoup-57486.firebaseapp.com",
  databaseURL: "https://turtlesoup-57486-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "turtlesoup-57486",
  storageBucket: "turtlesoup-57486.firebasestorage.app",
  messagingSenderId: "292337289991",
  appId: "1:292337289991:web:86cc0717ec722966ad13a2",
  measurementId: "G-6F35DBCKH4"
};

// 初始化应用
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// 本地缓存（优化加载速度）
let localCache = {
  subjects: {},
  questions: {},
  lastUpdated: 0,
  adminLoggedIn: false
};

// 数据过期时间（5分钟）
const CACHE_EXPIRY = 5 * 60 * 1000;

// 初始化数据库（首次运行时创建默认结构）
export async function initDatabase() {
  try {
    // 检查本地存储中的管理员登录状态
    const savedAdminState = localStorage.getItem('adminLoggedIn');
    if (savedAdminState === 'true') {
      localCache.adminLoggedIn = true;
      updateAdminUI(true);
    }

    const adminRef = ref(db, 'admin');
    const adminSnapshot = await get(adminRef);
    
    // 如果管理员密码未设置，初始化密码为419904
    if (!adminSnapshot.exists()) {
      await set(adminRef, { password: "419904" });
    }
    
    // 如果没有科目，添加默认科目
    const subjectsRef = ref(db, 'subjects');
    const subjectsSnapshot = await get(subjectsRef);
    if (!subjectsSnapshot.exists()) {
      const defaultSubjects = {
        math: { name: "数学", color: "#3b82f6" },
        physics: { name: "物理", color: "#10b981" },
        chemistry: { name: "化学", color: "#f59e0b" },
        biology: { name: "生物", color: "#ec4899" },
        history: { name: "历史", color: "#8b5cf6" },
        geography: { name: "地理", color: "#6366f1" }
      };
      await set(subjectsRef, defaultSubjects);
    }
    
    // 如果没有题目，添加默认题目
    const questionsRef = ref(db, 'questions');
    const questionsSnapshot = await get(questionsRef);
    if (!questionsSnapshot.exists()) {
      const defaultQuestions = {
        'q_1': {
          id: 'q_1',
          subject: 'math',
          difficulty: 'easy',
          question: '一个数，去掉前面一个数字后，是13。去掉最后一个数字后，是40。这个数是什么？',
          time: 5,
          keywords: ['数字', '去掉', '13', '40'],
          clues: [
            '这是一个两位数',
            '它与中文有关',
            '它的发音很关键'
          ],
          answer: '四十三（中文数字，去掉前面"四"是"十三"，去掉后面"三"是"四十"）',
          textbook: '小学数学一年级',
          knowledge: {
            title: '数字的多种表示方法',
            content: '数字可以有阿拉伯数字、中文数字等多种表示形式。在这个谜题中，利用了中文数字的特性来设计谜题。',
            relatedQuestions: [
              '什么数字去掉前面一个数字后是11，去掉最后一个数字后是50？',
              '如何用三种不同的方式表示数字10？'
            ]
          },
          createdAt: Date.now()
        }
      };
      await set(questionsRef, defaultQuestions);
    }
    
    // 预加载数据到缓存
    await preloadData();
    return true;
  } catch (error) {
    console.error("初始化数据库失败:", error);
    showNotification("数据加载失败，请检查网络连接", "error");
    return false;
  }
}

// 预加载数据到缓存（优化速度）
async function preloadData() {
  try {
    // 如果缓存未过期，直接使用缓存
    if (Date.now() - localCache.lastUpdated < CACHE_EXPIRY) {
      return localCache;
    }
    
    // 并行加载数据（优化速度）
    const [subjectsSnapshot, questionsSnapshot] = await Promise.all([
      get(ref(db, 'subjects')),
      get(ref(db, 'questions'))
    ]);
    
    // 更新缓存
    localCache.subjects = subjectsSnapshot.exists() ? subjectsSnapshot.val() : {};
    localCache.questions = questionsSnapshot.exists() ? questionsSnapshot.val() : {};
    localCache.lastUpdated = Date.now();
    
    // 更新UI
    updateSubjectUI();
    if (localCache.adminLoggedIn) {
      updateAdminTables();
    }
    
    return localCache;
  } catch (error) {
    console.error("预加载数据失败:", error);
    return localCache; // 即使失败也返回现有缓存
  }
}

// 获取所有科目
export async function getSubjects() {
  await preloadData();
  return { ...localCache.subjects }; // 返回副本，避免直接修改缓存
}

// 获取所有题目
export async function getQuestions() {
  await preloadData();
  return { ...localCache.questions };
}

// 根据学科和难度获取题目
export async function getQuestionsBySubjectAndDifficulty(subjectId, difficulty) {
  await preloadData();
  return Object.values(localCache.questions).filter(
    question => question.subject === subjectId && question.difficulty === difficulty
  );
}

// 根据ID获取题目
export async function getQuestionById(id) {
  await preloadData();
  return localCache.questions[id] ? { ...localCache.questions[id] } : null;
}

// 添加题目（管理员）
export async function addQuestion(questionData, adminPassword) {
  try {
    // 验证管理员密码
    const isAdmin = await verifyAdmin(adminPassword);
    if (!isAdmin) {
      showNotification("权限不足，请重新登录", "error");
      return null;
    }
    
    // 生成唯一ID
    const id = 'q_' + Date.now();
    const question = { ...questionData, id, createdAt: Date.now() };
    
    // 保存到数据库
    const questionRef = ref(db, `questions/${id}`);
    await set(questionRef, question);
    
    // 更新缓存
    localCache.questions[id] = question;
    localCache.lastUpdated = Date.now();
    
    showNotification("题目添加成功", "success");
    return question;
  } catch (error) {
    console.error("添加题目失败:", error);
    showNotification("添加题目失败，请重试", "error");
    return null;
  }
}

// 更新题目（管理员）
export async function updateQuestion(questionData, adminPassword) {
  try {
    // 验证管理员密码
    const isAdmin = await verifyAdmin(adminPassword);
    if (!isAdmin) {
      showNotification("权限不足，请重新登录", "error");
      return false;
    }
    
    const { id } = questionData;
    if (!id) return false;
    
    // 更新数据库
    const questionRef = ref(db, `questions/${id}`);
    await update(questionRef, questionData);
    
    // 更新缓存
    localCache.questions[id] = { ...localCache.questions[id], ...questionData };
    localCache.lastUpdated = Date.now();
    
    showNotification("题目更新成功", "success");
    return true;
  } catch (error) {
    console.error("更新题目失败:", error);
    showNotification("更新题目失败，请重试", "error");
    return false;
  }
}

// 删除题目（管理员）
export async function deleteQuestion(id, adminPassword) {
  try {
    // 验证管理员密码
    const isAdmin = await verifyAdmin(adminPassword);
    if (!isAdmin) {
      showNotification("权限不足，请重新登录", "error");
      return false;
    }
    
    // 从数据库删除
    const questionRef = ref(db, `questions/${id}`);
    await remove(questionRef);
    
    // 从缓存删除
    delete localCache.questions[id];
    localCache.lastUpdated = Date.now();
    
    showNotification("题目删除成功", "success");
    return true;
  } catch (error) {
    console.error("删除题目失败:", error);
    showNotification("删除题目失败，请重试", "error");
    return false;
  }
}

// 添加科目（管理员）
export async function addSubject(subjectData, adminPassword) {
  try {
    // 验证管理员密码
    const isAdmin = await verifyAdmin(adminPassword);
    if (!isAdmin) {
      showNotification("权限不足，请重新登录", "error");
      return false;
    }
    
    // 生成科目ID（小写字母）
    const id = subjectData.name.toLowerCase().replace(/\s+/g, '');
    
    // 检查科目是否已存在
    if (localCache.subjects[id]) {
      showNotification("该科目已存在", "warning");
      return false;
    }
    
    const subject = { 
      name: subjectData.name, 
      color: subjectData.color || "#3b82f6" 
    };
    
    // 保存到数据库
    const subjectRef = ref(db, `subjects/${id}`);
    await set(subjectRef, subject);
    
    // 更新缓存
    localCache.subjects[id] = subject;
    localCache.lastUpdated = Date.now();
    
    showNotification("科目添加成功", "success");
    return true;
  } catch (error) {
    console.error("添加科目失败:", error);
    showNotification("添加科目失败，请重试", "error");
    return false;
  }
}

// 删除科目（管理员）
export async function deleteSubject(id, adminPassword) {
  try {
    // 验证管理员密码
    const isAdmin = await verifyAdmin(adminPassword);
    if (!isAdmin) {
      showNotification("权限不足，请重新登录", "error");
      return false;
    }
    
    // 检查是否有关联题目
    const questions = await getQuestions();
    const hasRelatedQuestions = Object.values(questions).some(q => q.subject === id);
    if (hasRelatedQuestions) {
      showNotification("无法删除：该科目下存在题目", "error");
      return false;
    }
    
    // 从数据库删除
    const subjectRef = ref(db, `subjects/${id}`);
    await remove(subjectRef);
    
    // 从缓存删除
    delete localCache.subjects[id];
    localCache.lastUpdated = Date.now();
    
    showNotification("科目删除成功", "success");
    return true;
  } catch (error) {
    console.error("删除科目失败:", error);
    showNotification("删除科目失败，请重试", "error");
    return false;
  }
}

// 验证管理员密码
export async function verifyAdmin(password) {
  try {
    const adminRef = ref(db, 'admin');
    const snapshot = await get(adminRef);
    if (snapshot.exists()) {
      return snapshot.val().password === password;
    }
    return false;
  } catch (error) {
    console.error("验证管理员失败:", error);
    return false;
  }
}

// 管理员登录
export async function adminLogin(password) {
  const isAdmin = await verifyAdmin(password);
  if (isAdmin) {
    localCache.adminLoggedIn = true;
    localStorage.setItem('adminLoggedIn', 'true');
    updateAdminUI(true);
    return true;
  }
  return false;
}

// 管理员登出
export function adminLogout() {
  localCache.adminLoggedIn = false;
  localStorage.removeItem('adminLoggedIn');
  updateAdminUI(false);
}

// 检查管理员是否已登录
export function isAdminLoggedIn() {
  return localCache.adminLoggedIn;
}

// 实时监听数据变化（优化体验）
export function onDataChange(callback) {
  const subjectsRef = ref(db, 'subjects');
  const questionsRef = ref(db, 'questions');
  
  // 监听科目变化
  const subjectsListener = onValue(subjectsRef, (snapshot) => {
    localCache.subjects = snapshot.val() || {};
    localCache.lastUpdated = Date.now();
    updateSubjectUI();
    if (localCache.adminLoggedIn) {
      updateAdminSubjectList();
      updateQuestionSubjectOptions();
    }
    callback && callback({ subjects: localCache.subjects, questions: localCache.questions });
  });
  
  // 监听题目变化
  const questionsListener = onValue(questionsRef, (snapshot) => {
    localCache.questions = snapshot.val() || {};
    localCache.lastUpdated = Date.now();
    if (localCache.adminLoggedIn) {
      updateAdminTables();
    }
    callback && callback({ subjects: localCache.subjects, questions: localCache.questions });
  });
  
  // 返回取消监听的函数
  return () => {
    off(subjectsRef, subjectsListener);
    off(questionsRef, questionsListener);
  };
}

// 显示通知（优化用户体验）
export function showNotification(message, type = "info") {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 z-50 ${type}`;
  
  // 显示通知
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 100);
  
  // 3秒后隐藏
  setTimeout(() => {
    notification.style.transform = "translateX(calc(100% + 20px))";
  }, 3000);
}

// 更新学科UI
function updateSubjectUI() {
  const subjectGrid = document.getElementById('subjectGrid');
  if (!subjectGrid) return;
  
  // 清空现有内容（保留骨架屏直到数据加载完成）
  if (Object.keys(localCache.subjects).length > 0) {
    subjectGrid.innerHTML = '';
    
    // 添加学科卡片
    Object.entries(localCache.subjects).forEach(([id, subject], index) => {
      const card = document.createElement('div');
      card.className = 'subject-card rounded-lg shadow-md p-4 cursor-pointer';
      card.style.backgroundColor = subject.color;
      card.dataset.id = id;
      card.innerHTML = `<h3 class="text-lg font-bold">${subject.name}</h3>`;
      
      // 延迟添加动画，创建错落有致的效果
      setTimeout(() => {
        card.classList.add('fade-in');
      }, 100 * index);
      
      subjectGrid.appendChild(card);
    });
  }
}

// 更新管理员UI
function updateAdminUI(isLoggedIn) {
  const adminPanel = document.getElementById('adminPanel');
  const loginBtn = document.getElementById('loginBtn');
  const userStatus = document.getElementById('userStatus');
  
  if (isLoggedIn) {
    adminPanel?.classList.remove('hidden');
    loginBtn.textContent = '退出登录';
    userStatus.textContent = '管理员模式';
    updateAdminTables();
    updateAdminSubjectList();
    updateQuestionSubjectOptions();
  } else {
    adminPanel?.classList.add('hidden');
    loginBtn.textContent = '管理员登录';
    userStatus.textContent = '游客模式';
  }
}

// 更新管理员表格
function updateAdminTables() {
  const questionsTableBody = document.getElementById('questionsTableBody');
  if (!questionsTableBody) return;
  
  // 获取并显示题目
  const questions = Object.values(localCache.questions);
  const searchTerm = document.getElementById('searchQuestions')?.value.toLowerCase() || '';
  
  // 过滤搜索结果
  const filteredQuestions = searchTerm 
    ? questions.filter(q => 
        q.question.toLowerCase().includes(searchTerm) ||
        localCache.subjects[q.subject]?.name.toLowerCase().includes(searchTerm) ||
        getDifficultyName(q.difficulty).toLowerCase().includes(searchTerm)
      )
    : questions;
  
  // 清空表格
  questionsTableBody.innerHTML = '';
  
  // 如果没有题目
  if (filteredQuestions.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="4" class="py-4 px-6 text-center text-gray-500">
        没有找到题目，请添加新题目
      </td>
    `;
    questionsTableBody.appendChild(row);
    return;
  }
  
  // 添加题目到表格
  filteredQuestions.forEach(question => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition';
    row.innerHTML = `
      <td class="py-3 px-4 truncate max-w-xs" title="${question.question}">${question.question}</td>
      <td class="py-3 px-4">${localCache.subjects[question.subject]?.name || '未知'}</td>
      <td class="py-3 px-4">${getDifficultyName(question.difficulty)}</td>
      <td class="py-3 px-4">
        <div class="flex space-x-2">
          <button class="edit-btn text-blue-600 hover:text-blue-800" data-id="${question.id}">
            <i class="fa fa-pencil"></i> 编辑
          </button>
          <button class="delete-btn text-red-600 hover:text-red-800" data-id="${question.id}">
            <i class="fa fa-trash"></i> 删除
          </button>
        </div>
      </td>
    `;
    questionsTableBody.appendChild(row);
  });
}

// 更新管理员科目列表
function updateAdminSubjectList() {
  const subjectList = document.getElementById('subjectList');
  if (!subjectList) return;
  
  // 清空现有内容
  subjectList.innerHTML = '';
  
  // 添加科目
  Object.entries(localCache.subjects).forEach(([id, subject]) => {
    const subjectItem = document.createElement('div');
    subjectItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
    subjectItem.innerHTML = `
      <div class="flex items-center">
        <div class="w-4 h-4 rounded-full mr-2" style="background-color: ${subject.color}"></div>
        <span>${subject.name}</span>
      </div>
      <button class="delete-subject-btn text-red-500 hover:text-red-700" data-id="${id}">
        <i class="fa fa-trash"></i>
      </button>
    `;
    subjectList.appendChild(subjectItem);
  });
}

// 更新题目表单中的科目选项
function updateQuestionSubjectOptions() {
  const subjectSelect = document.getElementById('questionSubject');
  if (!subjectSelect) return;
  
  // 保存当前选中的值
  const currentValue = subjectSelect.value;
  
  // 清空现有选项
  subjectSelect.innerHTML = '';
  
  // 添加科目选项
  Object.entries(localCache.subjects).forEach(([id, subject]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = subject.name;
    subjectSelect.appendChild(option);
  });
  
  // 恢复选中值（如果存在）
  if (currentValue && localCache.subjects[currentValue]) {
    subjectSelect.value = currentValue;
  } else if (Object.keys(localCache.subjects).length > 0) {
    // 选中第一个选项
    subjectSelect.value = Object.keys(localCache.subjects)[0];
  }
}

// 获取难度名称
function getDifficultyName(difficulty) {
  const difficultyMap = {
    'easy': '简单',
    'medium': '中等',
    'hard': '困难'
  };
  return difficultyMap[difficulty] || difficulty;
}

// 初始化数据库
initDatabase();

// 暴露全局变量以便调试（生产环境可移除）
window.db = {
  getSubjects,
  getQuestions,
  isAdminLoggedIn,
  adminLogout
};
