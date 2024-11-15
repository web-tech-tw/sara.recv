"use strict";

module.exports = {
    subject: (data) => `於 ${data.audienceUrl} 上的 Sara 系統轉移成功`,
    text: (data) => `
        您好，這裡是 ${data.audienceUrl} 網站。
        使用者 ${data.userNickname} 已使用新的信箱 ${data.userEmailUpdated} 轉移成功。
        
        以下為授權成功的轉移資訊：
            申請識別碼：
                ${data.sessionId}
            授權時間：
                ${data.accessTm}
            授權目標裝置：
                ${data.accessUa}
            授權目標 IP 位址：
                ${data.accessIp}
            原電子郵件地址：
                ${data.userEmailOriginal}
            新電子郵件地址：
                ${data.userEmailUpdated}

        Sara 系統使用者識別碼：
            ${data.userId}
        
        本電子郵件由系統自動發送，請勿回覆。

        「Sara 系統」是一個開放原始碼的無密碼式身份認證解決方案，
        由臺灣網際網路技術推廣組織（https://web-tech.tw）提供技術支援。
    `,
    html: (data) => `
        <p>
            您好，這裡是 ${data.audienceUrl} 網站。<br/>
            使用者 ${data.userNickname} 已使用您的信箱 ${data.userEmailUpdated} 轉移成功。
        </p>
        <p>
            以下為授權成功的轉移資訊：<br/>
            <ul>
                <li>
                    申請識別碼：<br/>
                    ${data.sessionId}
                </li>
                <li>
                    授權時間：<br/>
                    ${data.accessTm}
                </li>
                <li>
                    授權目標裝置：<br/>
                    ${data.accessUa}
                </li>
                <li>
                    授權目標 IP 位址：<br/>
                    ${data.accessIp}
                </li>
                <li>
                    原電子郵件地址：<br/>
                    ${data.userEmailOriginal}
                </li>
                <li>
                    新電子郵件地址：<br/>
                    ${data.userEmailUpdated}
                </li>
            </ul>
        </p>
        <p>
            Sara 系統使用者識別碼：<br/>
            ${data.userId}
        </p>
        <p>
            本電子郵件由系統自動發送，請勿回覆。
        </p>
        <p>
            「Sara 系統」是一個開放原始碼的無密碼式身份認證解決方案。<br/>
            由 <a href="https://web-tech.tw">臺灣網際網路技術推廣組織</a> 提供技術支援。
        </p>
    `,
};
