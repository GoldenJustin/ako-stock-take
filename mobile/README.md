# AKO Stock Take – mobile

Expo 54 app for warehouse stock take against ERPNext.

**Justin Msengi · Koda Technologies**  
https://justinmsengi.com · justinemsengi@gmail.com  

## Run

```bash
npm install
npx expo start
```

Default ERPNext URL is set in `src/constants/config.ts`  
(https://erpnext.kodatechnologies.co.tz). Change it on the login screen if needed.

Login uses the same pattern as our SFA field app: password login, session `sid` cookie.

## Layout

```
app/           screens (expo-router)
src/api/       ERPNext client
src/store/     auth + session state
```

## License

MIT
