"use strict";

module.exports = {
    subject: (data) => `轉移 ${data.audienceUrl} 上的 Sara 系統帳號`,
    text: (data) => `
        您好，這裡是 ${data.audienceUrl} 網站。

        使用者 ${data.userNickname}，
        請求將帳號自電子郵件地址：
            ${data.userEmailOriginal}，
        轉移至本電子郵件地址：
            ${data.userEmailUpdated}
        上。

        這裡是您的轉移代碼：
            ${data.code}

        這份請求來自於：
            申請時間：
                ${data.sessionIp}
            申請識別碼：
                ${data.sessionId}
            申請來源裝置：
                ${data.sessionUa}
            申請來源 IP 位址：
                ${data.sessionIp}

        Sara 系統使用者識別碼：
            ${data.userId}

        若您未曾請求過該代碼，請您無視本電子郵件。
        
        「Sara 系統」是一個開放原始碼的無密碼式身份認證解決方案，
        由臺灣網際網路技術推廣組織（https://web-tech.tw）提供技術支援。
    `,
    html: (data) => `
        <p>
            您好，這裡是 ${data.audienceUrl} 網站。
        </p>
        <p>
            使用者 ${data.userNickname}，
            請求將帳號自電子郵件地址：
            ${data.userEmailOriginal}，
            轉移至本電子郵件地址：
            ${data.userEmailUpdated}
            上。
        </p>
        <p>
            這裡是您的轉移代碼：<br/>
            <font size="5">${data.code}</font>
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
            Sara 系統使用者識別碼：<br/>
            ${data.userId}
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