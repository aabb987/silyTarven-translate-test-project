//參考自青空莉想做舞台少女的狗所使用的'世界书繁简互换'，這是他的原文件連結：https://github.com/StageDog/tavern_resource/tree/main/src
//導入
import { toSimplified as n, toTraditional as t} from 'https://testingcf.jsdelivr.net/npm/chinese-simple2traditional/+esm';

//宣告變數
const buttonA = "翻譯成繁體";
const buttonB = "翻譯成簡體";

//函式
//const variables = getVariables({type: 'chat'});
async function i(t, e) {
    $('#send_textarea').val(t($('#send_textarea').val())),
    console.log('i() triggered with:', $('#send_textarea').val())
}


$(()=>{

    const buttonAClicked= getButtonEvent(buttonA);
    eventOn(buttonAClicked, () => {
        console.log('button翻譯成繁體 triggered:',getUserInput());
        i(t, '繁体');
    });

    const buttonBClicked= getButtonEvent(buttonB);
    eventOn(buttonBClicked, () => {
        console.log('button翻譯成簡體 triggered:',getUserInput());
        i(n, '简体');
    });

    function getUserInput () {
        const $input = $('#send_textarea')
        console.log('getUserInput() triggered:', $input.val());
        return $input.val();
    }


    appendInexistentScriptButtons([
        { name: buttonA, visible: !0}
    ]);

        appendInexistentScriptButtons([
        { name: buttonB, visible: !0}
    ]);

});
