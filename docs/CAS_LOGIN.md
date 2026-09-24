# CAS 登录鉴权流程(给无上下文的模型)

目标:用学工号和密码,通过 `https://qyrz.xjvut.edu.cn/cas` 的统一身份认证登录。共 4 步,必须按顺序,共用同一个 Cookie 会话。

## 第 1 步:拿 execution

```
GET https://qyrz.xjvut.edu.cn/cas/login
```

返回 HTML。从中提取隐藏域的值:

```html
<input type="hidden" name="execution" value="<长字符串,约5000字符>">
```

后面要用。每次 GET 这个页面,execution 都会变,只用最新拿到的。

## 第 2 步:拿公钥

```
POST https://qyrz.xjvut.edu.cn/cas/v1/getPubKey
Content-Type: application/json
X-Requested-With: XMLHttpRequest

(空 body 或 {})
```

返回:

```json
{"modulus": "十六进制大数", "exponent": "10001"}
```

同时响应会种下 Cookie `_pv0CAS`。这个 Cookie 必须保留,第 4 步必须带上,否则登录失败——服务端用它核对你是用哪把公钥加密的密码。

## 第 3 步:拿验证码

```
GET https://qyrz.xjvut.edu.cn/cas/getKaptchaStatus
```

返回 `true` 就需要验证码;`false` 跳过本步。

需要时:

```
GET https://qyrz.xjvut.edu.cn/cas/kaptcha?time=<当前毫秒时间戳>
```

返回一张算术题图片,比如写着 `0+19=?`。答案(如 `19`)填到第 4 步的 `authcode`。图里是 `数字+数字=?`,直接算。

## 第 4 步:提交登录

密码先加密(见下节),然后:

```
POST https://qyrz.xjvut.edu.cn/cas/login
Content-Type: application/x-www-form-urlencoded
Cookie: 必须包含第 2 步的 _pv0CAS

username=<学工号>
password=<加密后的密码,128位十六进制字符串>
code=                          ← 固定空值,但必须有这个字段
authcode=<验证码答案>
execution=<第 1 步的值>          ← 原样放入,注意 URL 编码
_eventId=submit
type=zhmm
```

结果判定(实测):

- HTTP 401 = 失败,响应是新的登录页(里面的 execution 已经换了,重试要从第 1 步重来)。错误原因在页面 `class` 含 `error` 的元素文字里:
  - `authenticationFailure.FailedAuthcodeException` → 验证码错,或没带 `_pv0CAS`(服务端找不到配对的公钥)
  - `Your account is not recognized and cannot login at this time.` → 验证码已通过,账号不存在或密码错
- 成功:302 重定向到业务系统地址,同时会话 Cookie 可访问受保护页面。

## 密码加密

是 RSA,但**不做 PKCS#1 填充**,就是最朴素的 `pow(m, e, n)`。密码先倒序再加密,而底层字节序又把倒序抵消了,所以最终公式非常简单:

```python
m = int.from_bytes(明文密码.encode(), "big")   # 密码的 ASCII 字节,按大端转成整数
cipher = pow(m, int(exponent, 16), int(modulus, 16))
password = format(cipher, "x")                 # 十六进制;若长度不是4的倍数,左侧补0至4的倍数
```

- 指数固定 `10001`(即 65537),modulus 每次会话不同,用第 2 步拿到的。
- 常见密码(不超过 62 字节)就是一个整数,输出约 128 位十六进制。
- 服务端会解密后比对,所以必须用**当次会话**的 modulus 加密,并带上配对的 `_pv0CAS`。

## 易错点

1. `_pv0CAS` 忘带 → 实测必败,报 `FailedAuthcodeException`(验证码对了也一样)。
2. execution 是上一轮的 → 失败,回到第 1 步重来。
3. password 放了明文或 PKCS#1 填充的密文 → 失败,必须是无填充 RSA。
4. `code` 字段漏掉 → 表单不完整,可能失败。
5. 验证码错 → 失败,服务器会换掉 execution,必须从第 1 步全部重来。
