"use strict";

module.exports = {
    subject: (data) => `註冊 ${data.audienceUrl} 上的 Sara 系統帳號`,
    text: (data) => `
        您好，這裡是 ${data.audienceUrl} 網站。
        使用者 ${data.userNickname} 申請使用您的信箱 ${data.userEmail} 進行註冊。
        
        這裡是您的註冊代碼：
            ${data.code}

        這份請求來自於：
            申請時間：
                ${data.sessionTm}
            申請識別碼：
                ${data.sessionId}
            申請來源裝置：
                ${data.sessionUa}
            申請來源 IP 位址：
                ${data.sessionIp}

        若您未曾請求過該代碼，請您無視本電子郵件。
        
        「Sara 系統」是一個開放原始碼的無密碼式身份認證解決方案，
        由臺灣網際網路技術推廣組織（https://web-tech.tw）提供技術支援。
    `,
    html: (data) => `
        <p>
            您好，這裡是 ${data.audienceUrl} 網站。<br/>
            使用者 ${data.userNickname} 申請使用您的信箱 ${data.userEmail} 進行註冊。
        </p>
        <p>
            這裡是您的註冊代碼：<br/>
            <code>${data.code}</code>
        </p>
        <p>
            這份請求來自於：
            <ul>
                <li>
                    申請時間：<br/>
                    ${data.sessionTm}
                </li>
                <li>
                    申請識別碼：<br/>
                    ${data.sessionId}
                </li>
                <li>
                    申請來源裝置：<br/>
                    ${data.sessionUa}
                </li>
                <li>
                    申請來源 IP 位址：<br/>
                    ${data.sessionIp}
                </li>
            </ul>
        </p>
        <p>
            若您未曾請求過該代碼，請您無視本電子郵件。
        </p>
        <p>
            「Sara 系統」是一個開放原始碼的無密碼式身份認證解決方案，由
            <a href="https://web-tech.tw">臺灣網際網路技術推廣組織</a>
            提供技術支援。<br/>
        </p>
    `,
};
