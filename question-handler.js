// 处理用户问题并生成回答
export async function handleUserQuestion(question, soup) {
    // 转换为小写以提高匹配容错性
    const lowerQuestion = question.trim().toLowerCase();
    
    // 检查是否是终止性问题（如"答案是什么"）
    const terminationKeywords = ['答案', '是什么', '揭晓', '结束', '最终', '直接说'];
    if (terminationKeywords.some(keyword => lowerQuestion.includes(keyword))) {
        return '请使用"猜答案"按钮来尝试回答。';
    }
    
    // 查找匹配的关键词
    const matchedKeywords = findMatchedKeywords(lowerQuestion, soup);
    
    // 如果没有匹配的关键词，返回"无关"
    if (matchedKeywords.length === 0) {
        return '无关';
    }
    
    // 查找相关的线索
    const relevantClue = findRelevantClue(matchedKeywords, soup.clues);
    
    // 如果找到相关线索，返回线索
    if (relevantClue) {
        return relevantClue;
    }
    
    // 否则，根据问题类型返回"是"或"否"
    return isYesNoQuestion(lowerQuestion) ? '是' : '否';
}

// 查找匹配的关键词（优化：关键词转换为小写）
function findMatchedKeywords(question, soup) {
    return soup.keywords.filter(keyword => 
        question.includes(keyword.toLowerCase())
    );
}

// 查找相关的线索
function findRelevantClue(keywords, clues) {
    // 遍历线索，找到包含任何关键词的线索
    for (const clue of clues) {
        const lowerClue = clue.toLowerCase();
        if (keywords.some(keyword => lowerClue.includes(keyword.toLowerCase()))) {
            return clue;
        }
    }
    return null;
}

// 判断是否是需要回答"是"或"否"的问题
function isYesNoQuestion(question) {
    const yesNoQuestionStarters = [
        '是不是', '是否', '对吗', '是吗', '有吗',
        '会吗', '能吗', '可以吗', '可能吗', '存在吗',
        '有没有', '会不会', '能不能', '可不可能'
    ];
    
    return yesNoQuestionStarters.some(starter => question.startsWith(starter)) ||
           question.endsWith('吗') ||
           (question.endsWith('？') && (question.includes('是') || question.includes('有')));
}

// 检查答案相似度（优化：更灵活的匹配条件）
export function checkAnswerSimilarity(userAnswer, soup) {
    if (!userAnswer || !soup || !soup.answer) return false;
    
    const lowerUserAnswer = userAnswer.trim().toLowerCase();
    const lowerCorrectAnswer = soup.answer.trim().toLowerCase();
    
    // 如果答案完全匹配，直接返回true
    if (lowerUserAnswer === lowerCorrectAnswer) return true;
    
    // 提取答案中的关键词
    const answerKeywords = soup.keywords.map(k => k.toLowerCase());
    
    // 计算匹配的关键词数量
    const matchedCount = answerKeywords.filter(keyword => 
        lowerUserAnswer.includes(keyword)
    ).length;
    
    // 匹配超过1/3的关键词即视为相似
    return matchedCount > 0 && matchedCount >= Math.ceil(answerKeywords.length / 3);
}
