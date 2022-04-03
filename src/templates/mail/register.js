"use strict";

module.exports = {
    subject: (data) => `向 ${data.website} 上的Sara系統註冊帳號`,
    text: (data) => `
        您好，這裡是 ${data.website} 網站，有人申請使用您的信箱 ${data.to} 進行註冊。
        
        這裡是您的註冊代號：${data.code}
        
        若您未曾請求過該代碼，請您無視本電子郵件。
        
        「Sara 系統」是一個開放原始碼的無密碼式身份認證解決方案，由臺灣網際網路技術推廣組織（https://web-tech-tw.github.io）提供技術支援。
    `,
    html: (data) => `
        您好，這裡是 ${data.website} 網站，有人申請使用您的信箱 ${data.to} 進行註冊<br/>
        <p>這裡是您的註冊代號：<br/><code>${data.code}</code></p>
        <p>若您未曾請求過該代碼，請您無視本電子郵件。</p>
        「Sara 系統」是一個開放原始碼的無密碼式身份認證解決方案，由
        <a href="https://web-tech-tw.github.io">臺灣網際網路技術推廣組織</a>
        提供技術支援。<br/>
    `,
};
