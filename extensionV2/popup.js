document.getElementById("send").addEventListener("click", async () => {

    const cookie = await chrome.cookies.get({
        url: "https://leetcode.com",
        name: "LEETCODE_SESSION"
    });

    if (!cookie) {
        alert("No session cookie found");
        return;
    }

    console.log(cookie.value);

    const response = await fetch("http://localhost:8000/test/checkCookie", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            cookie: cookie.value
        })
    });

    const data = await response.json();

    console.log(data);

    alert("Cookie sent successfully");
});