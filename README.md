# xgettext-utils

```javascript
extract({
    path: ['./pathtosource'],
    target: './locale/templates.js'
}).then(function () {
    return generator({
        locales: ['uk', 'ru', 'en'],
        target: './locales',
        name: 'messages',
        source:['./locale']
    })
}).then(function(){
    console.log('generate complete');
});
```
