// ============================================================
//  MAGI MOCK Engine v4.0
//  Universal module - works in Node.js and browser
//  Improvements over v3:
//    - 2 new domains (technology, legal)
//    - Intensity modifiers (非常/特别/极其 boost sentiment)
//    - Confidence scores per system (0-100%)
//    - 15 templates per direction (up from 12)
//    - Summary conclusion line per analysis
//    - Improved scoring formulas with domain-specific nuance
// ============================================================

(function(exports) {
  'use strict';

  // ====== 领域关键词库 (8 domains) ======
  const MOCK_DOMAINS = {
    career: { keywords: ['工作','跳槽','辞职','离职','转行','升职','面试','offer','薪资','涨薪','创业','副业','职业','就业','失业','入职','转正','降薪','内卷','PUA'], label: '职业发展' },
    finance: { keywords: ['投资','买房','买车','理财','股票','基金','存款','贷款','消费','购物','花钱','预算','租金','还贷','保险','加密货币','币圈','比特币','炒股','定投','期货','基金定投'], label: '财务决策' },
    relationship: { keywords: ['表白','分手','结婚','离婚','恋爱','相亲','约会','复合','友情','朋友','家人','父母','暗恋','追','脱单','出轨','冷战','婆媳','挽回','告白','单身'], label: '人际关系' },
    health: { keywords: ['健身','减肥','手术','治疗','吃药','体检','作息','熬夜','饮食','戒烟','戒酒','看病','住院','养生','跑步','节食','失眠','抑郁','焦虑症','体检报告'], label: '健康生活' },
    education: { keywords: ['考研','留学','读博','转专业','选课','学习','培训','考证','读书','论文','毕业','升学','GPA','托福','雅思','读研','读硕','博后','复读','公考','考公'], label: '教育学习' },
    lifestyle: { keywords: ['搬家','旅行','养宠物','整容','纹身','改名','租房','换手机','移民','出国','回老家','独居','装修','二胎','丁克','gap'], label: '生活方式' },
    technology: { keywords: ['编程','代码','开发','软件','APP','AI','人工智能','算法','前端','后端','全栈','技术栈','框架','开源','GitHub','机器学习','深度学习','大模型','服务器','数据库'], label: '科技技术' },
    legal: { keywords: ['法律','起诉','诉讼','合同','律师','维权','仲裁','赔偿','纠纷','违约','侵权','专利','商标','版权','协议','条款','官司'], label: '法律事务' }
  };

  // ====== 情感词库 ======
  const MOCK_POSITIVE = ['喜欢','想要','期待','希望','梦想','开心','兴奋','热爱','值得','应该','好','棒','机会','信心','决心','渴望','向往','憧憬','幸运','满意','感激'];
  const MOCK_NEGATIVE = ['担心','害怕','焦虑','犹豫','纠结','恐惧','不安','后悔','讨厌','不想','不愿意','麻烦','累','难','迷茫','舍不得','心痛','委屈','尴尬','失望','愤怒','心累'];
  const MOCK_RISK = ['风险','危险','冒险','赌','不确定','未知','失败','亏损','赔','坑','陷阱','骗局','不稳','波动','雷','暴雷','血本无归'];
  const MOCK_URGENCY = ['紧急','马上','立刻','现在','赶紧','快','尽快','deadline','最后','来不及','催','赶','过期'];
  const MOCK_COST = ['贵','花','成本','代价','费','预算','钱','投入','花费','烧钱','昂贵','掏空','房贷','卡债'];

  // ====== 强度修饰词 (boost sentiment magnitude) ======
  const MOCK_INTENSITY = ['非常','特别','极其','超级','相当','十分','极度','异常','分外','格外'];

  // ====== 问题类型检测 ======
  const MOCK_QTYPES = [
    { pattern: /要不要|该不该|是否|应不应该|应否|能不能|可以吗|好吗|行吗/, type: 'yesno', label: '是否型决策' },
    { pattern: /还是|或者|vs|VS|对比|比较|哪个好|选哪个|A还是B/, type: 'choice', label: '选择型决策' },
    { pattern: /值不值得|值得吗|划算|亏不亏|合算/, type: 'worth', label: '价值型决策' },
    { pattern: /怎么办|怎么选|如何|该怎么/, type: 'howto', label: '方向型决策' }
  ];

  // ====== 种子哈希 (保证同一问题投票一致，文本有变化) ======
  function mockSeed(question, salt) {
    let hash = 0;
    const str = question + '|' + salt;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & 0x7fffffff;
    }
    return hash;
  }

  function mockPick(arr, seed) {
    return arr[seed % arr.length];
  }

  // ====== 问题分析器 v4 ======
  function analyzeQuestion(question) {
    const a = {
      domain: null, domainLabel: '该决策',
      sentiment: 0, rawSentiment: 0, riskLevel: 0, urgency: 0, costLevel: 0,
      intensity: 0,
      qType: 'yesno', qTypeLabel: '是否型决策',
      keywords: [], positiveWords: [], negativeWords: [],
      length: question.length
    };

    // 领域检测
    for (const [key, val] of Object.entries(MOCK_DOMAINS)) {
      const matched = val.keywords.filter(kw => question.includes(kw));
      if (matched.length > 0) {
        a.domain = key; a.domainLabel = val.label; a.keywords = matched; break;
      }
    }

    // 情感分析 (-3 ~ +3, v4 expanded range)
    a.positiveWords = MOCK_POSITIVE.filter(w => question.includes(w));
    a.negativeWords = MOCK_NEGATIVE.filter(w => question.includes(w));
    a.rawSentiment = a.positiveWords.length - a.negativeWords.length;

    // 强度修饰检测
    a.intensity = MOCK_INTENSITY.filter(w => question.includes(w)).length;
    // 强度词将情感绝对值提升 1
    a.sentiment = Math.max(-3, Math.min(3, a.rawSentiment + (a.intensity > 0 ? Math.sign(a.rawSentiment) * 1 : 0)));
    if (a.rawSentiment === 0 && a.intensity === 0) a.sentiment = 0;

    // 风险 / 紧急 / 成本
    a.riskLevel = Math.min(3, MOCK_RISK.filter(w => question.includes(w)).length);
    a.urgency = Math.min(2, MOCK_URGENCY.filter(w => question.includes(w)).length);
    a.costLevel = Math.min(2, MOCK_COST.filter(w => question.includes(w)).length);

    // 问题类型
    for (const qt of MOCK_QTYPES) {
      if (qt.pattern.test(question)) { a.qType = qt.type; a.qTypeLabel = qt.label; break; }
    }

    return a;
  }

  // ====== 三系统独立决策引擎 v4 ======
  // 返回 { vote, confidence } — confidence 为 0-100

  function decideMelchior(a) {
    let score = 0;
    score += a.sentiment * 2;
    score -= a.riskLevel * 2;
    if (a.costLevel > 0 && a.sentiment <= 0) score -= 1;
    if (a.urgency > 0 && a.sentiment <= 0) score -= 1;
    if (a.domain === 'finance' && a.riskLevel > 0) score -= 1;
    if (a.domain === 'education' && a.sentiment >= 0) score += 1;
    if (a.domain === 'health' && a.sentiment >= 0) score += 1;
    if (a.domain === 'technology' && a.sentiment >= 0) score += 1;
    if (a.domain === 'legal' && a.riskLevel > 0) score -= 1;

    let vote, confidence;
    if (score >= 2) { vote = 'approve'; confidence = Math.min(98, 60 + (score - 2) * 12); }
    else if (score <= -2) { vote = 'deny'; confidence = Math.min(98, 60 + (-score - 2) * 12); }
    else { vote = 'abstain'; confidence = 50 + Math.abs(score) * 5; }
    return { vote, confidence: Math.round(confidence) };
  }

  function decideBalthasar(a) {
    let score = 0;
    score += a.sentiment;
    if (a.domain === 'relationship' && a.sentiment < 0) score -= 2;
    if (['health','career','education','technology'].includes(a.domain) && a.sentiment >= 0) score += 1;
    score -= a.riskLevel;
    if (a.domain === 'finance' && a.riskLevel >= 2) score -= 1;
    if (a.domain === 'relationship' && a.keywords.some(k => ['分手','离婚','出轨','冷战','单身'].includes(k))) score -= 1;
    if (a.domain === 'legal' && a.sentiment < 0) score -= 1;

    let vote, confidence;
    if (score >= 2) { vote = 'approve'; confidence = Math.min(98, 60 + (score - 2) * 12); }
    else if (score <= -2) { vote = 'deny'; confidence = Math.min(98, 60 + (-score - 2) * 12); }
    else { vote = 'abstain'; confidence = 50 + Math.abs(score) * 5; }
    return { vote, confidence: Math.round(confidence) };
  }

  function decideCaspar(a) {
    let score = 0;
    score += a.sentiment * 2;
    if (a.urgency > 0) score += a.sentiment > 0 ? 1 : -1;
    score -= a.riskLevel;
    if (a.domain === 'relationship') score += a.sentiment;
    if (a.domain === 'lifestyle' && a.sentiment > 0) score += 1;
    if (a.domain === 'technology' && a.sentiment > 0) score += 1;
    if (a.intensity > 0) score += Math.sign(a.sentiment); // 强度词增强直觉

    let vote, confidence;
    if (score >= 1) { vote = 'approve'; confidence = Math.min(98, 55 + (score - 1) * 10); }
    else if (score <= -1) { vote = 'deny'; confidence = Math.min(98, 55 + (-score - 1) * 10); }
    else { vote = 'abstain'; confidence = 45 + Math.abs(score) * 8; }
    return { vote, confidence: Math.round(confidence) };
  }

  // ====== 组合式动态文本生成 v4.0 ======
  // 15 主模板 × 8 修饰 × 8 领域注解 = 960 种/系统/投票方向
  // 总计 960 × 3系统 × 3投票 = 8640 种组合

  const MOCK_TEXTS = {
    melchior: {
      approve: [
        a => `从理性模型分析，${a.domainLabel}的决策树指向正向路径。预期收益明确，风险评估显示主要变量可控。`,
        a => `数据驱动的评估结果为：${a.domainLabel}具备推进条件。成本回报比在合理区间，执行路径清晰。`,
        a => `逻辑推演完成。${a.domainLabel}的核心假设稳固，环境变量处于有利区间，长期收益模型为正。`,
        a => `基于成本收益框架，${a.domainLabel}的净预期值为正。风险敞口有对冲空间，收益预期高于投入。`,
        a => `可行性模型运算完毕——${a.domainLabel}的关键指标处于有利区间。资源条件基本具备，执行难度适中。`,
        a => `量化分析显示${a.domainLabel}的期望收益大于执行成本。最优路径概率较高，下行风险有限。`,
        a => `${a.domainLabel}的理性评估模型给出正面结论。多因素加权评分位于正向区间，模型建议推进。`,
        a => `从贝叶斯推断角度，${a.domainLabel}的后验概率偏向有利结果。先验信息与观测数据一致指向执行。`,
        a => `${a.domainLabel}的变量分析已完成，主要因子指向执行方向。决策矩阵最优策略为推进。`,
        a => `敏感性分析显示${a.domainLabel}在多场景下均保持正收益。关键假设经受住了压力测试。`,
        a => `${a.domainLabel}的蒙特卡洛模拟结果为正。75%分位以上的场景均支持执行决策。`,
        a => `理性维度评估完成。${a.domainLabel}的信息熵较低，不确定性在可接受范围内，建议执行。`,
        a => `期望效用理论分析完成。${a.domainLabel}在当前信息集下的期望效用最大化为执行，犹豫的机会成本更高。`,
        a => `博弈论框架下，${a.domainLabel}属于正和博弈——各方利益可以兼顾，合作收益大于单边行动。`,
        a => `系统动力学模拟显示${a.domainLabel}将产生正向反馈循环。初期投入会在后续周期产生复利效应。`
      ],
      deny: [
        a => `理性分析显示${a.domainLabel}的风险敞口过大，关键变量不可控。预期收益无法覆盖潜在损失，模型不建议执行。`,
        a => `${a.domainLabel}的成本收益比为负。核心假设缺乏支撑，执行路径不清晰，不确定性过高。`,
        a => `逻辑推演指向否定。${a.domainLabel}的主要变量偏离有利区间，下行风险显著大于上行收益。`,
        a => `可行性评估未通过。${a.domainLabel}的资源缺口明显，风险对冲手段不足，净预期值为负。`,
        a => `${a.domainLabel}的决策树分析：失败概率较高且损失不可逆。理性模型建议暂缓。`,
        a => `量化分析显示${a.domainLabel}的期望损失大于预期收益。多场景模拟中负面结果占比超过60%。`,
        a => `从贝叶斯推断角度，${a.domainLabel}的后验概率偏向不利结果。观测数据修正了先验假设。`,
        a => `敏感性分析发出警告：${a.domainLabel}在关键变量波动时收益急剧下降，鲁棒性不足。`,
        a => `${a.domainLabel}的风险溢价过高。经风险调整后的收益率仍为负，模型无法支持该方向。`,
        a => `理性维度评估完成。${a.domainLabel}的信息熵过高，不确定性超出可接受阈值，建议否决。`,
        a => `${a.domainLabel}的蒙特卡洛模拟结果为负。超过55%的场景指向不利结果。`,
        a => `多因素加权评分位于负向区间。${a.domainLabel}的核心假设在压力测试中未通过验证。`,
        a => `期望效用理论分析完成。${a.domainLabel}在当前信息集下的期望效用为负，执行将降低整体效用水平。`,
        a => `博弈论框架下，${a.domainLabel}接近零和甚至负和博弈——一方的收益建立在另一方的损失之上。`,
        a => `系统动力学模拟显示${a.domainLabel}可能触发负向反馈循环。初期损失会在后续周期放大。`
      ],
      abstain: [
        a => `${a.domainLabel}的理性评估为中性。部分条件已具备，但关键收益和风险均不够明确，需补充信息后决策。`,
        a => `成本收益模型处于临界状态。${a.domainLabel}的正面和负面因素基本对等，理性角度无法给出明确倾向。`,
        a => `${a.domainLabel}的可行性评估为中等。执行路径存在但不确定因素较多，建议收集更多信息。`,
        a => `逻辑分析结果为中性偏谨慎。${a.domainLabel}的核心变量尚不明朗，当前信息不足以支持明确决策。`,
        a => `敏感性分析结果不明确：${a.domainLabel}在不同假设下结果差异较大，无法得出稳健结论。`,
        a => `${a.domainLabel}的贝叶斯后验概率接近50%，正面和负面证据相互抵消。`,
        a => `量化评估处于灰色地带。${a.domainLabel}的风险收益比恰好位于临界值附近，需要更多观测数据。`,
        a => `信息熵分析显示${a.domainLabel}的不确定性处于中等水平。当前信息量不足以做出明确判断。`,
        a => `多场景模拟结果分散。${a.domainLabel}在不同假设下的结果方差过大，建议补充关键变量信息。`,
        a => `${a.domainLabel}的决策树存在多个等概率分支，无法确定最优路径。理性模型保持中立。`,
        a => `期望效用分析无法区分执行与不执行的差异。${a.domainLabel}的效用函数在当前参数下无显著偏好。`,
        a => `博弈论分析显示${a.domainLabel}的收益结构取决于对手策略，信息不完全下无法做出最优判断。`,
        a => `系统动力学模拟显示${a.domainLabel}的长期效应存在滞后性，短期数据不足以判断反馈方向。`,
        a => `${a.domainLabel}的模型在多目标优化中存在帕累托前沿冲突，无法在不牺牲某维度的前提下改进。`,
        a => `理性模型进入等待状态。${a.domainLabel}的关键变量正在演化中，过早决策将损失信息价值。`
      ]
    },
    balthasar: {
      approve: [
        a => `该决策符合基本伦理责任，对他人和社会关系没有明显伤害，且体现了对自身的负责。${a.domainLabel}在道德层面站得住脚。`,
        a => `从道德角度审视，${a.domainLabel}体现了诚信与关怀。对他人无伤害，对自身是负责任的选择。`,
        a => `${a.domainLabel}在伦理评估中表现正面：不违背承诺，不伤害他人，且具有积极的社会价值。`,
        a => `道德层面支持该方向。${a.domainLabel}体现了对自身和他人的尊重，情感关怀维度评估通过。`,
        a => `伦理模型分析完成。${a.domainLabel}符合功利主义原则——总体幸福增量为正，且不侵犯任何个体权利。`,
        a => `从义务论角度，${a.domainLabel}不违背任何道德准则。决策者保持了诚信，对利益相关方尽到了责任。`,
        a => `${a.domainLabel}的道德审查通过。行为动机正当，手段合理，预期后果对他人无负面影响。`,
        a => `美德伦理学评估为正面。${a.domainLabel}体现了勇气、审慎或正义等美德，是一个值得肯定的选择。`,
        a => `${a.domainLabel}在关怀伦理框架下表现良好：考虑了他人的感受，维护了关系中的信任与尊重。`,
        a => `从正义论角度，${a.domainLabel}符合公平原则。不损害任何人的正当权益，资源分配合理。`,
        a => `${a.domainLabel}的道德推理链完整：意图善意、手段适度、后果可接受，伦理评估为正面。`,
        a => `伦理维度审查完毕。${a.domainLabel}在自律与他律之间取得了平衡，是一个道德上可接受的决定。`,
        a => `从德性伦理角度，${a.domainLabel}有助于培养长期品格——它体现的不是一时的冲动，而是稳定的价值取向。`,
        a => `${a.domainLabel}在道德直觉层面引发了正面的共情反应。设身处地考虑，他人也会做出同样的选择。`,
        a => `哈贝马斯交往行动理论检验通过。${a.domainLabel}可以在理性对话中被所有相关方接受，具备普遍化条件。`
      ],
      deny: [
        a => `从道德角度看，${a.domainLabel}可能伤害到他人或违背承诺，存在明显的伦理隐患。建议重新审视。`,
        a => `${a.domainLabel}在伦理评估中存在冲突：可能忽视他人感受，或违背已有的责任与承诺。`,
        a => `道德层面发出警告。${a.domainLabel}可能造成情感伤害或社会关系损伤，伦理责任未得到妥善考量。`,
        a => `${a.domainLabel}的道德评估未通过：存在对他人潜在的伤害，或对自身不负责任的倾向。`,
        a => `从功利主义角度，${a.domainLabel}可能造成的总体痛苦大于总体幸福。利益相关方的净福祉为负。`,
        a => `义务论审查未通过。${a.domainLabel}可能违背了已有的承诺或道德义务，手段本身存在道德瑕疵。`,
        a => `${a.domainLabel}的道德审查发现风险：行为动机可能不纯，或预期后果对特定个体造成不当伤害。`,
        a => `美德伦理学评估为负面。${a.domainLabel}可能体现了冲动、自私或逃避责任等缺陷。`,
        a => `${a.domainLabel}在关怀伦理框架下表现不佳：可能忽视了他人的情感需求，损害了关系中的信任。`,
        a => `从正义论角度，${a.domainLabel}可能损害弱势方的正当权益，资源分配存在不公平倾向。`,
        a => `${a.domainLabel}的道德推理链断裂：意图与后果之间存在伦理断裂，行为手段的正当性存疑。`,
        a => `伦理维度审查未通过。${a.domainLabel}在自律与他律之间存在张力，道德上难以被接受。`,
        a => `从德性伦理角度，${a.domainLabel}可能侵蚀长期品格——它反映的不是审慎，而是对短期满足的妥协。`,
        a => `${a.domainLabel}在道德直觉层面引发了不安。即使设身处地为他人着想，也很难为这个选择辩护。`,
        a => `哈贝马斯交往行动理论检验未通过。${a.domainLabel}无法在理性对话中被所有相关方普遍接受。`
      ],
      abstain: [
        a => `道德层面没有显著冲突，也不具有突出的道德增益。${a.domainLabel}整体呈中性，需要更多伦理维度的信息。`,
        a => `${a.domainLabel}在伦理评估中为中性。对他人无明显伤害，但也没有突出的积极道德价值。`,
        a => `${a.domainLabel}的道德影响尚不明确。既不存在显著的伦理冲突，也缺乏明确的道德正面信号。`,
        a => `伦理模型分析结果为中性。${a.domainLabel}的功利主义和义务论评估均未给出明确倾向。`,
        a => `从关怀伦理角度，${a.domainLabel}的影响取决于具体执行方式和涉及的个体感受，当前信息不足以判断。`,
        a => `${a.domainLabel}的道德审查处于灰色地带。既不明确违背道德准则，也不显著体现美德。`,
        a => `美德伦理学评估为中性。${a.domainLabel}既不特别体现美德，也不存在明显的道德缺陷。`,
        a => `${a.domainLabel}在正义论框架下既无显著不公平，也无突出的公平正义体现。道德维度保持中立。`,
        a => `伦理推理链不完整：${a.domainLabel}的意图、手段和后果中存在不确定环节，无法做出明确道德判断。`,
        a => `${a.domainLabel}在自律与他律之间处于平衡点。道德维度无法给出明确倾向，需补充伦理信息。`,
        a => `德性伦理分析无法判断${a.domainLabel}对品格的长期影响。需要更多关于动机和执行方式的细节。`,
        a => `${a.domainLabel}在道德直觉层面反应平淡。既没有强烈的道德认同，也没有明显的道德排斥。`,
        a => `哈贝马斯交往行动理论的检验结果不明确。${a.domainLabel}在不同视角下可能被接受也可能被质疑。`,
        a => `${a.domainLabel}涉及的道德维度过于复杂，正反两面的伦理论证都有一定说服力，无法轻易裁定。`,
        a => `道德模型进入观望状态。${a.domainLabel}的伦理影响需要随时间展开后才能做出更准确的评估。`
      ]
    },
    caspar: {
      approve: [
        a => `内心对${a.domainLabel}有强烈的正面信号，情感驱动力充足，直觉上认为时机合适。`,
        a => `直觉层面发出积极信号。${a.domainLabel}让内心感到期待和兴奋，内在驱动与行动方向一致。`,
        a => `${a.domainLabel}触发了正面的直觉反应。内心有一种"就是现在"的感觉，情感层面支持推进。`,
        a => `直觉判断为正面。${a.domainLabel}引发了内心的渴望，情感信号清晰且强烈。`,
        a => `内心深处涌起一股暖流。${a.domainLabel}让灵魂感到共鸣，这种内在的呼唤值得倾听。`,
        a => `${a.domainLabel}在直觉层面引发了强烈的共鸣感。内心仿佛被牵引着向前，这种感觉很真实。`,
        a => `直觉雷达扫描完毕——${a.domainLabel}的情感反馈为强阳性。内心有一种笃定感，不需要更多理由。`,
        a => `从第六感角度，${a.domainLabel}散发着正面的能量场。内心的天线接收到的信号是"去做了"。`,
        a => `${a.domainLabel}让内心产生了一种久违的悸动。这种情感不是冲动，而是深层的自我认同。`,
        a => `直觉告诉我，${a.domainLabel}是对的方向。内心的声音清晰而坚定，没有丝毫犹豫的回响。`,
        a => `情感维度共振强烈。${a.domainLabel}在内心激起了涟漪，这种共鸣来自更深层的自我。`,
        a => `内心深处有一个声音在说"yes"。${a.domainLabel}触发了潜意识的正面反馈，值得信任。`,
        a => `当想到${a.domainLabel}时，身体先于头脑做出了反应——一种轻盈和期待的感觉油然而生。`,
        a => `${a.domainLabel}在梦境中也曾出现过类似的意象。潜意识似乎早已给出了答案，只是理性还在追赶。`,
        a => `直觉的罗盘稳定地指向${a.domainLabel}。内在的导航系统没有发出任何偏航警告。`
      ],
      deny: [
        a => `直觉上发出警告信号，内心深处存在不安。${a.domainLabel}让人感到犹豫，这种不安值得认真对待。`,
        a => `${a.domainLabel}在直觉层面引发了抗拒。内心有一种说不清的不安，情感信号建议暂停。`,
        a => `直觉判断为负面。${a.domainLabel}让人感到焦虑和不安，内心的声音在说"再等等"。`,
        a => `内心对${a.domainLabel}有不好的预感。直觉建议谨慎，这种不安并非空穴来风。`,
        a => `内心深处掠过一丝寒意。${a.domainLabel}让灵魂感到排斥，这种本能的抗拒值得尊重。`,
        a => `${a.domainLabel}在直觉层面引发了明显的警觉反应。内心仿佛有一道无形的屏障在说"不要"。`,
        a => `直觉雷达扫描到异常——${a.domainLabel}的情感反馈为强阴性。内心有一种强烈的不安感。`,
        a => `从第六感角度，${a.domainLabel}散发着不祥的能量场。内心的天线下意识地在摇头。`,
        a => `${a.domainLabel}让内心产生了一种隐隐的排斥。这种不适感是身体在发出信号，值得留意。`,
        a => `直觉告诉我，${a.domainLabel}可能不是好的选择。内心深处有一个声音在说"别这样做"。`,
        a => `情感维度发出排斥信号。${a.domainLabel}在内心激起了不安的涟漪，这种抗拒来自潜意识深处。`,
        a => `内心深处有一个声音在说"no"。${a.domainLabel}触发了本能的警觉反应，不应忽视。`,
        a => `当想到${a.domainLabel}时，胃部先于大脑紧缩了一下。身体的智慧往往比思维更诚实。`,
        a => `${a.domainLabel}在想象中总是伴随着一种不协调感。潜意识似乎在用它自己的方式说"不"。`,
        a => `直觉的罗盘在${a.domainLabel}方向上出现了明显的偏转和颤抖。内在导航系统正在发出警告。`
      ],
      abstain: [
        a => `直觉信号较弱，内心没有强烈的驱动或抗拒。${a.domainLabel}暂时无法触发明确的直觉判断。`,
        a => `${a.domainLabel}在情感层面反应平淡。直觉既没有推动也没有阻止，处于观望状态。`,
        a => `内心对${a.domainLabel}的感觉模糊。情感信号不够清晰，直觉暂时保持中立。`,
        a => `直觉雷达扫描结果为空白——${a.domainLabel}没有触发明显的情感反馈。`,
        a => `${a.domainLabel}在直觉层面像是隔着一层雾。内心既不兴奋也不排斥，暂时无法读取出明确信号。`,
        a => `内心的天线接收到的信号是灰色的。${a.domainLabel}既不让人心动也不让人不安。`,
        a => `直觉告诉我，现在还不是做判断的时候。${a.domainLabel}的情感反馈太微弱，需要更多体验来校准。`,
        a => `${a.domainLabel}在情感维度上处于静默状态。内心没有波澜，直觉保持中立观望。`,
        a => `情感雷达未检测到明显信号。${a.domainLabel}在直觉层面如同白噪音，无法提取有效特征。`,
        a => `内心深处对${a.domainLabel}既无呼唤也无排斥。直觉频道暂时静默，保持中立。`,
        a => `当想到${a.domainLabel}时，身体没有给出明确反应。既没有轻盈感也没有紧缩感，处于中性状态。`,
        a => `${a.domainLabel}在想象中既不闪亮也不暗淡。潜意识似乎在说"我还需要更多信息"。`,
        a => `直觉的罗盘在${a.domainLabel}方向上静止不动。无法判断这是暂时的平静还是永久的沉默。`,
        a => `内心对${a.domainLabel}的感受像是未调准的收音机——有微弱的信号但不清晰，需要更多时间来锁定。`,
        a => `情感维度的信噪比太低。${a.domainLabel}的直觉信号淹没在背景噪音中，暂时无法提取。`
      ]
    }
  };

  // ====== 上下文修饰片段 ======
  const MOCK_MODIFIERS = {
    melchior: [
      a => a.riskLevel > 0 ? ` 风险因子评级${a.riskLevel}/3，已纳入风险溢价计算。` : '',
      a => a.costLevel > 0 ? ` 成本维度触发${a.costLevel}级权重调整。` : '',
      a => a.sentiment !== 0 ? ` 用户情感指数${a.sentiment > 0 ? '+' : ''}${a.sentiment}，作为辅助变量纳入模型。` : '',
      a => a.urgency > 0 ? ` 时序紧迫度${a.urgency}/2，影响执行窗口评估。` : '',
      a => a.keywords.length > 0 ? ` 识别到关键要素：${a.keywords.slice(0, 3).join('、')}。` : '',
      a => a.intensity > 0 ? ` 情感强度修饰词×${a.intensity}，已放大情感权重。` : '',
      () => ` 量化置信度校准完毕。`,
      () => ` 模型版本：MELCHIOR-4.0。`
    ],
    balthasar: [
      a => a.keywords.length > 0 ? ` 涉及要素：${a.keywords.slice(0, 2).join('、')}，已纳入伦理影响评估。` : '',
      a => a.sentiment < 0 ? ` 检测到负面情绪信号，已提升关怀维度权重。` : '',
      a => a.domain === 'relationship' ? ` 人际关系维度已激活，情感伤害风险评估启动。` : '',
      a => a.riskLevel > 0 ? ` 道德风险等级${a.riskLevel}/3，已交叉验证。` : '',
      a => a.intensity > 0 ? ` 情感强度异常，已调整关怀灵敏度。` : '',
      () => ` 伦理模型版本：BALTHASAR-4.0。`,
      () => ` 关怀指数校准完毕。`,
      () => ''
    ],
    caspar: [
      a => a.sentiment > 0 ? ` 情感温度计读数：温暖（+${a.sentiment}）。` : '',
      a => a.sentiment < 0 ? ` 情感温度计读数：寒冷（${a.sentiment}）。` : '',
      a => a.urgency > 0 ? ` 内心时钟正在加速——感知到紧迫感。` : '',
      a => a.keywords.length > 0 ? ` 直觉锚点：「${a.keywords[0]}」触发了深层联想。` : '',
      a => a.intensity > 0 ? ` 情感增幅器激活——强度×${a.intensity}。` : '',
      () => ` 直觉灵敏度：高。`,
      () => ` 情感信号强度：中等。`,
      () => ''
    ]
  };

  // ====== 领域专属注解 (8 domains × 3 systems) ======
  const MOCK_DOMAIN_NOTES = {
    melchior: {
      career: () => ' 职业发展曲线分析显示当前轨迹处于上升期。',
      finance: () => ' 财务回报模型在95%置信区间内为正。',
      relationship: () => ' 关系网络的拓扑结构分析已完成。',
      health: () => ' 健康投入的长期ROI模型支持该方向。',
      education: () => ' 教育复利效应在5-10年周期内显著。',
      lifestyle: () => ' 生活方式变量的时间序列分析完毕。',
      technology: () => ' 技术栈生命周期分析显示当前处于采用曲线早期。',
      legal: () => ' 法律风险矩阵已构建，关键条款合规性已交叉验证。',
      null: () => ''
    },
    balthasar: {
      career: () => ' 职业选择对家庭和社交圈的影响已纳入评估。',
      finance: () => ' 财务决策对家庭福祉的影响已纳入关怀伦理框架。',
      relationship: () => ' 关系中的信任、承诺和情感纽带已纳入伦理审查。',
      health: () => ' 健康决策对自身和关爱之人的道德责任已评估。',
      education: () => ' 教育选择对个人成长和社会贡献的伦理价值已考量。',
      lifestyle: () => ' 生活方式变更对周围人的情感影响已审视。',
      technology: () => ' 技术选择对社会和个体自主性的伦理影响已评估。',
      legal: () => ' 法律行动对各方的公平与正义影响已纳入审查。',
      null: () => ''
    },
    caspar: {
      career: () => ' 内心对职业方向有一种说不出的向往。',
      finance: () => ' 直觉对金钱的流动有一种微妙的感知。',
      relationship: () => ' 情感雷达在人际关系维度格外敏锐。',
      health: () => ' 身体的本能反应比头脑更早给出了信号。',
      education: () => ' 内心对知识有一种纯粹的渴望在涌动。',
      lifestyle: () => ' 生活方式的选择触发了深层自我认同的回响。',
      technology: () => ' 内心对技术的可能性有一种原始的兴奋。',
      legal: () => ' 直觉在正义与非正义之间有着敏锐的嗅觉。',
      null: () => ''
    }
  };

  // ====== 置信度标签 ======
  function confidenceLabel(conf) {
    if (conf >= 85) return '高置信';
    if (conf >= 70) return '中高置信';
    if (conf >= 55) return '中等置信';
    return '低置信';
  }

  // ====== MOCK v4 主函数 — 组合式文本生成 + 置信度 ======
  function pickMockResult(question) {
    const a = analyzeQuestion(question);
    const seed = question.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    const mDec = decideMelchior(a);
    const bDec = decideBalthasar(a);
    const cDec = decideCaspar(a);

    // 组合：主模板 + 上下文修饰 + 领域注解 + 置信度
    const mMain = mockPick(MOCK_TEXTS.melchior[mDec.vote], seed)(a);
    const mMod = mockPick(MOCK_MODIFIERS.melchior, seed + 3)(a);
    const mDom = (MOCK_DOMAIN_NOTES.melchior[a.domain] || MOCK_DOMAIN_NOTES.melchior.null)(a);
    const mConf = ` [置信度:${mDec.confidence}% ${confidenceLabel(mDec.confidence)}]`;

    const bMain = mockPick(MOCK_TEXTS.balthasar[bDec.vote], seed + 7)(a);
    const bMod = mockPick(MOCK_MODIFIERS.balthasar, seed + 11)(a);
    const bDom = (MOCK_DOMAIN_NOTES.balthasar[a.domain] || MOCK_DOMAIN_NOTES.balthasar.null)(a);
    const bConf = ` [置信度:${bDec.confidence}% ${confidenceLabel(bDec.confidence)}]`;

    const cMain = mockPick(MOCK_TEXTS.caspar[cDec.vote], seed + 13)(a);
    const cMod = mockPick(MOCK_MODIFIERS.caspar, seed + 17)(a);
    const cDom = (MOCK_DOMAIN_NOTES.caspar[a.domain] || MOCK_DOMAIN_NOTES.caspar.null)(a);
    const cConf = ` [置信度:${cDec.confidence}% ${confidenceLabel(cDec.confidence)}]`;

    return {
      melchior: { analysis: mMain + mMod + mDom + mConf, vote: mDec.vote, confidence: mDec.confidence },
      balthasar: { analysis: bMain + bMod + bDom + bConf, vote: bDec.vote, confidence: bDec.confidence },
      caspar: { analysis: cMain + cMod + cDom + cConf, vote: cDec.vote, confidence: cDec.confidence }
    };
  }

  // ====== 导出 (兼容 Node.js 和浏览器) ======
  exports.pickMockResult = pickMockResult;
  exports.analyzeQuestion = analyzeQuestion;
  exports.decideMelchior = decideMelchior;
  exports.decideBalthasar = decideBalthasar;
  exports.decideCaspar = decideCaspar;
  exports.MOCK_VERSION = '4.0';
  exports.MOCK_DOMAINS = MOCK_DOMAINS;

})(typeof module !== 'undefined' ? module.exports : (window.MAGI_MOCK = {}));
