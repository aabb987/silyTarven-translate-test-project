//參考自青空莉想做舞台少女的狗所使用的'世界书繁简互换'，這是他的原文件連結：https://github.com/StageDog/tavern_resource/tree/main/src


$(() => {
    // === Button Names ===
    const BUTTON_NAMES = {
        SEND_TRADITIONAL: '翻譯成繁體',
        SEND_SIMPLIFIED: '翻譯成簡體',
        OUTPUT: '翻譯最新回覆',
    } as const;

    const MENU_CONFIG = {
        id: 'th-custom-extension-menu-item',
        name: '開啟翻譯按鈕',
    } as const;

    let toSimplified: ((input: string) => string) | null = null;
    let toTraditional: ((input: string) => string) | null = null;
    const CONVERTER_MODULE_URL = 'https://testingcf.jsdelivr.net/npm/chinese-simple2traditional/+esm';

    const ensureConverters = async (): Promise<void> => {
        if (toSimplified && toTraditional) return;
        const module = (await import(
            /* webpackIgnore: true */ CONVERTER_MODULE_URL
        )) as {
            toSimplified: (input: string) => string;
            toTraditional: (input: string) => string;
        };
        toSimplified = module.toSimplified;
        toTraditional = module.toTraditional;
    };

    const performTextConversion = (text: string, target: 'traditional' | 'simplified'): string => {
        return target === 'traditional'
            ? toTraditional?.(text) ?? text
            : toSimplified?.(text) ?? text;
    };

    const convertSendTextarea = async (target: 'traditional' | 'simplified'): Promise<void> => {
        const $input = $('#send_textarea');
        if ($input.length === 0) {
            toastr.error('找不到輸入框 #send_textarea');
            return;
        }
        const sourceText = String($input.val() ?? '');
        if (!sourceText) return;
        try {
            await ensureConverters();
            const convertedText = performTextConversion(sourceText, target);
            $input.val(convertedText);
            $input.trigger('input').trigger('focus');
            toastr.success(target === 'traditional' ? '已轉換為繁體' : '已轉換為簡體');
        } catch (error) {
            console.error(error);
            toastr.error('繁簡轉換載入失敗');
        }
    };

    const convertMessageFloor = async (messageId: number, target: 'traditional' | 'simplified'): Promise<boolean> => {
        const messages = getChatMessages(messageId);
        const message = messages[0];
        if (!message) return false;
        const sourceText = String(message.message ?? '');
        if (!sourceText) return false;
        await ensureConverters();
        const convertedText = performTextConversion(sourceText, target);
        if (convertedText === sourceText) return false;
        await setChatMessages(
            [{ message_id: messageId, message: convertedText }],
            { refresh: 'affected' },
        );
        return true;
    };

    const resolveReceiveTranslateTarget = (): 'traditional' | 'simplified' | null => {
        const states = getAutoTranslateReceiveStates();
        return states.traditional ? 'traditional' : states.simplified ? 'simplified' : null;
    };

    const createMutualExclusiveCheckboxHandler =
        (id: string, otherCheckboxIds: string[], successMsg: string) =>
        (function (this: HTMLInputElement) {
            const newState = Boolean(this.checked);
            setCheckboxState(id, newState);
            if (newState) {
                otherCheckboxIds.forEach(otherId => setCheckboxState(otherId, false));
            }
            toastr.success(successMsg);
        });

    const convertLatestOutputMessage = async (option?: { silentNoTarget?: boolean }): Promise<boolean> => {
        const target = resolveReceiveTranslateTarget();
        if (!target) {
            if (!option?.silentNoTarget) console.log('請先勾選接收轉繁體或接收轉簡體');
            return false;
        }
        const latestMessageId = getLastMessageId();
        if (latestMessageId < 0) return false;
        if (!(await convertMessageFloor(latestMessageId, target))) {
            console.log('最新回覆無需轉換');
            return false;
        }
        toastr.success(target === 'traditional' ? '已將最新回覆轉為繁體' : '已將最新回覆轉為簡體');
        return true;
    };

    const waitForGenerationUnlock = async (timeoutMs = 3000) => {
        await new Promise<void>((resolve) => {
            let settled = false;
            let stopStopped: EventOnReturn | null = null;
            let stopEnded: EventOnReturn | null = null;

            const done = () => {
                if (settled) {
                    return;
                }
                settled = true;
                stopStopped?.stop();
                stopEnded?.stop();
                resolve();
            };

            stopStopped = eventOnce(tavern_events.GENERATION_STOPPED, () => done());
            stopEnded = eventOnce(tavern_events.GENERATION_ENDED, () => done());
            setTimeout(done, timeoutMs);
        });
    };

    // === Initialize Buttons ===
    appendInexistentScriptButtons(
        Object.values(BUTTON_NAMES).map(name => ({ name, visible: true }))
    );

    const buttonHandlers: Record<string, () => Promise<any>> = {
        [BUTTON_NAMES.SEND_TRADITIONAL]: () => convertSendTextarea('traditional'),
        [BUTTON_NAMES.SEND_SIMPLIFIED]: () => convertSendTextarea('simplified'),
        [BUTTON_NAMES.OUTPUT]: () => convertLatestOutputMessage(),
    };

    Object.entries(buttonHandlers).forEach(([buttonName, handler]) => {
        eventOn(getButtonEvent(buttonName), () => void handler());
    });

    // === Checkbox Configuration ===
    type CheckboxConfig = {
        id: string;
        name: string;
        state: boolean;
        label: 'traditional' | 'simplified';
        type: 'send' | 'receive';
    };

    const checkboxConfigs: CheckboxConfig[] = [
        { id: 'auto-translate-send-input-checkbox-s', name: '自動將送出訊息轉為簡體', state: false, label: 'simplified', type: 'send' },
        { id: 'auto-translate-send-input-checkbox-t', name: '自動將送出訊息轉為繁體', state: false, label: 'traditional', type: 'send' },
        { id: 'auto-translate-receive-output-checkbox-s', name: '自動將收到的訊息轉為簡體', state: false, label: 'simplified', type: 'receive' },
        { id: 'auto-translate-receive-output-checkbox-t', name: '自動將收到的訊息轉為繁體', state: false, label: 'traditional', type: 'receive' },
    ];

    const getCheckboxConfig = (id: string) => checkboxConfigs.find(c => c.id === id);
    const getCheckboxState = (id: string) => getCheckboxConfig(id)?.state ?? false;
    const setCheckboxState = (id: string, state: boolean) => {
        const config = getCheckboxConfig(id);
        if (config) config.state = state;
    };

    // Derived getters for backward compatibility
    const getAutoTranslateSendStates = () => {
        const s = getCheckboxState('auto-translate-send-input-checkbox-s');
        const t = getCheckboxState('auto-translate-send-input-checkbox-t');
        return { simplified: s, traditional: t };
    };

    const getAutoTranslateReceiveStates = () => {
        const s = getCheckboxState('auto-translate-receive-output-checkbox-s');
        const t = getCheckboxState('auto-translate-receive-output-checkbox-t');
        return { simplified: s, traditional: t };
    };

    const processingMessageIds = new Set<number>();



    const onMenuButtonClick = () => {
        $('.th-custom-popup-ui').remove();

        const checkboxHtml = checkboxConfigs
            .map(
                config =>
                    `<div class="flex-container alignitemscenter" style="gap:8px; margin-bottom:8px;">
                        <input type="checkbox" id="${config.id}"
                        name="${config.name}" ${config.state ? 'checked' : ''} />
                        <label for="${config.id}">${config.name}</label>
                    </div>`,
            )
            .join('\n');

        const $menuUi = $(`
        <div class="th-custom-popup-ui" style="
        position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
                width: min(640px, calc(100vw - 24px));
                max-height: calc(100vh - 24px);
                overflow: auto;
                background: var(--SmartThemeBlurTintColor);
                border: 1px solid var(--SmartThemeBorderColor);
                border-radius: 10px;
            padding: 16px;
                z-index: 35000;
        ">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header"
                    style="display:flex; justify-content:space-between; align-items:center;">
                    <b>翻譯操作介面</b>
                    <button type="button" class="menu_button th-custom-popup-close">關閉</button>
                </div>

                <div class="inline-drawer-content" style="display:block;">
                    ${checkboxHtml}
                </div>
            </div>
        </div>

        `);

        $menuUi.appendTo('body');
        $menuUi.find('.th-custom-popup-close').on('click', () => {
            $menuUi.remove();
        });
        // Setup checkbox handlers
        const checkboxPairs = [
            {
                id: 'auto-translate-send-input-checkbox-s',
                otherId: 'auto-translate-send-input-checkbox-t',
                msg: '送出轉簡體',
            },
            {
                id: 'auto-translate-send-input-checkbox-t',
                otherId: 'auto-translate-send-input-checkbox-s',
                msg: '送出轉繁體',
            },
            {
                id: 'auto-translate-receive-output-checkbox-s',
                otherId: 'auto-translate-receive-output-checkbox-t',
                msg: '接收轉簡體',
            },
            {
                id: 'auto-translate-receive-output-checkbox-t',
                otherId: 'auto-translate-receive-output-checkbox-s',
                msg: '接收轉繁體',
            },
        ];

        checkboxPairs.forEach(({ id, otherId, msg }) => {
            $menuUi.find(`#${id}`).on(
                'change',
                createMutualExclusiveCheckboxHandler(id, [otherId], `${msg}：${getCheckboxState(id) ? '開啟' : '關閉'}`),
            );
        });
    };

    const insertMenuItem = (): void => {
        if (document.getElementById(MENU_CONFIG.id)) return;
        const $menu = $('#extensionsMenu');
        if ($menu.length === 0) return;
        const $list = $menu.find('.list-group').first().length > 0 ? $menu.find('.list-group').first() : $menu;
        const $item = $(`
      <a id="${MENU_CONFIG.id}" class="list-group-item" href="javascript:void(0)">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        ${MENU_CONFIG.name}
      </a>
    `);
        $item.on('click', onMenuButtonClick);
        $list.append($item);
    };

    insertMenuItem();

    eventMakeFirst(tavern_events.MESSAGE_SENT, async (message_id: number) => {
        const sendStates = getAutoTranslateSendStates();
        const target = sendStates.traditional ? 'traditional' : sendStates.simplified ? 'simplified' : null;
        if (!target || processingMessageIds.has(message_id)) return;
        processingMessageIds.add(message_id);
        try {
            const hasStoppedGeneration = stopAllGeneration();
            await convertMessageFloor(message_id, target);
            if (hasStoppedGeneration) {
                await waitForGenerationUnlock();
            } else {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            await triggerSlash('/trigger');
        } catch (error) {
            console.error(error);
            console.log('自動繁簡轉換後送出失敗', error);
        } finally {
            processingMessageIds.delete(message_id);
        }
    });

    const processingReceivedMessageIds = new Set<number>();

    eventOn(tavern_events.MESSAGE_RECEIVED, async (message_id: number) => {
        const target = resolveReceiveTranslateTarget();
        if (!target || processingReceivedMessageIds.has(message_id)) {
            return;
        }

        if (message_id !== getLastMessageId()) {
            return;
        }

        processingReceivedMessageIds.add(message_id);
        try {
            await convertLatestOutputMessage({ silentNoTarget: true });
        } catch (error) {
            console.error(error);
            console.log('自動轉換最新回覆失敗', error);
        } finally {
            processingReceivedMessageIds.delete(message_id);
        }
    });

    const observer = new MutationObserver(() => {
        insertMenuItem();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    $(window).on('pagehide', () => {
        observer.disconnect();
        $(`#${MENU_CONFIG.id}`).off('click');
        $('.th-custom-popup-ui').remove();
    });
});


