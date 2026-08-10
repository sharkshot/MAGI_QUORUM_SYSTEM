const API_BASE = 'http://localhost:3000'; // 部署后改成你的后端域名
const voteJpMap = { approve: '承認', deny: '否定', abstain: '保留' };

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Page({
  data: {
    code: '265',
    extension: '4088',
    exMode: 'OFF',
    question: '',
    isAnalyzing: false,
    logs: [],
    votes: {
      balthasar: '—',
      melchior: '—',
      caspar: '—'
    },
    decision: '—',
    decisionClass: '',
    activeSystem: '',
    booted: false,
    apiStatus: 'CHECKING...',
    apiOnline: false
  },

  onLoad() {
    this.runBootSequence();
    this.checkApiStatus();
  },

  async runBootSequence() {
    const bootMessages = [
      'MAGI SYSTEM INITIALIZING...',
      'KERNEL: OK',
      'MELCHIOR-01: ONLINE',
      'BALTHASAR-02: ONLINE',
      'CASPAR-03: ONLINE',
      'PERSONALITY LINK: ESTABLISHED',
      'VOTE PROTOCOL: ACTIVE',
      'SYSTEM READY'
    ];
    for (const msg of bootMessages) {
      console.log(msg);
      await sleep(250 + Math.random() * 200);
    }
    await sleep(300);
    this.setData({ booted: true });
  },

  checkApiStatus() {
    wx.request({
      url: `${API_BASE}/api/config`,
      method: 'GET',
      success: (res) => {
        const cfg = res.data || {};
        const online = cfg.mode === 'ai';
        this.setData({ apiStatus: online ? `ONLINE / ${cfg.model}` : 'MOCK MODE', apiOnline: online });
      },
      fail: () => {
        this.setData({ apiStatus: 'OFFLINE', apiOnline: false });
      }
    });
  },

  onInput(e) {
    this.setData({ question: e.detail.value });
  },

  reset() {
    this.setData({
      code: '265',
      extension: '4088',
      exMode: 'OFF',
      question: '',
      isAnalyzing: false,
      logs: [],
      votes: { balthasar: '—', melchior: '—', caspar: '—' },
      decision: '—',
      decisionClass: '',
      activeSystem: ''
    });
  },

  async execute() {
    const question = this.data.question.trim();
    if (!question || this.data.isAnalyzing) return;

    this.setData({
      isAnalyzing: true,
      code: String(Math.floor(Math.random() * 900 + 100)),
      extension: String(Math.floor(Math.random() * 9000 + 1000)),
      exMode: 'ON',
      logs: [
        { key: 'melchior', title: 'MELCHIOR-01 / 理性分析', text: '', color: 'cyan' },
        { key: 'balthasar', title: 'BALTHASAR-02 / 道德评估', text: '', color: 'cyan' },
        { key: 'caspar', title: 'CASPAR-03 / 直觉判别', text: '', color: 'red' }
      ],
      votes: { balthasar: '—', melchior: '—', caspar: '—' },
      decision: '—',
      decisionClass: ''
    });

    await sleep(400);

    let result;
    try {
      result = await this.fetchAIAnalysis(question);
    } catch (err) {
      const errMsg = (err.message || '请求失败').includes('timeout')
        ? '请求超时，后端服务可能未启动'
        : (err.message || '请求失败');
      this.setData({
        'logs[0].text': `⚠ ${errMsg}`,
        'logs[1].text': '等待服务恢复...',
        'logs[2].text': '等待服务恢复...',
        isAnalyzing: false,
        exMode: 'OFF'
      });
      return;
    }

    const systemKeys = ['melchior', 'balthasar', 'caspar'];
    const votes = {};

    for (const sysKey of systemKeys) {
      this.setData({ activeSystem: sysKey });
      await sleep(900 + Math.random() * 700);

      const item = result[sysKey] || { analysis: '分析数据缺失。', vote: 'abstain' };
      const vote = item.vote || 'abstain';
      votes[sysKey] = vote;

      const votesUpdate = { ...this.data.votes, [sysKey]: voteJpMap[vote] || '保留' };
      this.setData({ votes: votesUpdate, activeSystem: '' });

      await this.typewriter(sysKey, item.analysis);
      await sleep(200);
    }

    await sleep(500);
    this.showDecision(votes);
    if (result.mode === 'mock_fallback') {
      wx.showToast({
        title: result.fallback_reason || 'AI API 不可用，结果为模拟数据',
        icon: 'none',
        duration: 4000
      });
      this.setData({ apiStatus: 'FALLBACK', apiOnline: false });
    }
    this.setData({ isAnalyzing: false, exMode: 'OFF' });
  },

  fetchAIAnalysis(question) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE}/api/analyze`,
        method: 'POST',
        timeout: 30000,
        header: { 'Content-Type': 'application/json' },
        data: { question },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.error || `HTTP ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '网络请求失败'));
        }
      });
    });
  },

  typewriter(sysKey, text) {
    return new Promise(resolve => {
      let i = 0;
      const logs = this.data.logs.map(log => {
        if (log.key === sysKey) return { ...log, text: '' };
        return log;
      });
      this.setData({ logs });

      const timer = setInterval(() => {
        if (i >= text.length) {
          clearInterval(timer);
          resolve();
          return;
        }
        const updatedLogs = this.data.logs.map(log => {
          if (log.key === sysKey) return { ...log, text: log.text + text[i] };
          return log;
        });
        this.setData({ logs: updatedLogs });
        i++;
      }, 12);
    });
  },

  showDecision(votes) {
    const counts = { approve: 0, deny: 0, abstain: 0 };
    Object.values(votes).forEach(v => { if (counts[v] !== undefined) counts[v]++; });
    let decision = 'abstain', jpText = '保留';
    if (counts.approve >= 2) { decision = 'approve'; jpText = '承認'; }
    else if (counts.deny >= 2) { decision = 'deny'; jpText = '否定'; }
    this.setData({ decision: jpText, decisionClass: decision + ' reveal' });
  }
});
