import type { ChangeEvent, KeyboardEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import classNames from 'classnames';
import { useIntl } from 'react-intl';
import { Icon } from 'components/layout/icons';
import backspaceIcon from 'resources/svg-sprites/icons/backspace.svg';
import chevronDownIcon from 'resources/svg-sprites/icons/chevron-down.svg';
import styles from './seeker.module.scss';

const _colorCb = 'background: #171e21; color:orange; padding: 2px 3px';
const _colorEffect = 'background: #171e21; color:#924cd8; padding: 2px 3px';

// Augment forwardRef to allow for a generic type
declare module 'react' {
    function forwardRef<T, P = {}>(
        render: (props: P, ref: React.Ref<T>) => React.ReactElement | null
    ): (props: P & React.RefAttributes<T>) => React.ReactElement | null;
}

const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
};

const inputEscapingMap: [RegExp, string][] = [
    [/\\/g, '\\\\'],
    [/\(/g, '\\('],
    [/\)/g, '\\)'],
    [/\[/g, '\\['],
    [/\]/g, '\\]'],
];

const groupPriority = {
    top: 1,
    without: 2,
    with: 3,
    bottom: 3,
};

interface SuggestionProps {
    preselectedItemName: string;
    inputValue: string;
}

/**
 * Get name of an item by nameKey.
 *
 * For now it's unused, we decided to flatten some keys of "item" object instead of do recursive walk-through
 *
 * @param item - item from the list
 * @param nameKey - could be `a.b.c` then we should get `item[a][b][c]`
 * @returns {string}
 */
function GetName<Item extends { [key: string]: any }>(item: Item, nameKey: string): string {
    type SubObj = { [key: string]: SubObj | string };
    const keys = nameKey.split('.');
    let name = '';
    let subObject: SubObj = item;
    for (const key of keys) {
        let result = subObject[key];
        if (typeof result === 'string') {
            name += result;
            break;
        } else {
            subObject = result;
        }
    }

    return name;
}

/**
 *  Render grey colored suggested text for autocomplete.
 *  Will be rendered if there is some strings inside suggestion list + 'regex' match from the first char of an input value.
 */
const Suggestion = ({ preselectedItemName, inputValue }: SuggestionProps) => {
    let invisiblePart = '';
    let visiblePart = '';
    inputValue = inputValue.replace(/\\/g, '');
    if (preselectedItemName.toLowerCase().indexOf(inputValue.toLowerCase()) === 0) {
        invisiblePart = inputValue.replace(/\s/g, '\u00a0');
        visiblePart = preselectedItemName.substring(inputValue.length).replace(/\s/g, '\u00a0');
    }

    return (
        <div className={styles.suggestion}>
            <span className={styles.invisible}>{invisiblePart}</span>
            <span className={styles.visible}>{visiblePart}</span>
        </div>
    );
};

interface DropdownProps<Item> {
    availableToSelect: Item[];
    nameKey?: keyof Item;
    idKey?: keyof Item;
    regex: null | RegExp;
    pointerPosition: number;
    selectItem: (item: Item | null) => void;
    preventClosing: (e: React.MouseEvent | React.TouchEvent | null) => void;
    cancelClosingPrevention: (e: React.MouseEvent | React.TouchEvent | null) => void;
}

function DropdownInner<Item extends { [key: string]: any }>(
    { availableToSelect, nameKey, idKey, regex, pointerPosition, selectItem, preventClosing, cancelClosingPrevention }: DropdownProps<Item>,
    ref: React.ForwardedRef<HTMLDivElement>
) {
    const intl = useIntl();

    let _nameKey = (nameKey || 'name') as keyof Item;

    if (nameKey === undefined) {
        throw new Error('nameKey is undefined');
    }

    let renderList: JSX.Element[] = [];
    let currentGroup = '';

    availableToSelect.forEach((item, index) => {
        let group = item.group || 'default';
        if (group !== currentGroup) {
            currentGroup = group;
            if (currentGroup === 'top' || currentGroup === 'default') {
                renderList.push(<li key={'g-' + index} className={styles.divider} />);
            } else {
                renderList.push(
                    <li key={'g-' + index} className={styles.group}>
                        {intl.formatMessage({ id: `app.items.groups.${group}` })}
                    </li>
                );
            }
        }

        let name = item[_nameKey] as string;
        let textNodes: JSX.Element[] = [];
        let cNames = classNames(styles.entry, { [styles.selected]: pointerPosition === index });

        if (regex !== null) {
            for (let charIndex = name.search(regex), cnt = 0; charIndex !== -1 && cnt < 30; cnt++) {
                let matchedlenght = name.match(regex)![0].trim().length;

                if (charIndex !== 0) {
                    charIndex++;
                    textNodes.push(<span key={cnt}>{name.slice(0, charIndex)}</span>);
                }

                textNodes.push(<b key={cnt}>{name.slice(charIndex, charIndex + matchedlenght)}</b>);
                name = name.slice(charIndex + matchedlenght);
                charIndex = name.search(regex);
            }

            if (name.length > 0) {
                textNodes.push(<span key={'fin'}>{name}</span>);
            }
        } else {
            textNodes.push(<span key={'full'}>{name}</span>);
        }

        renderList.push(
            <li
                key={index}
                className={cNames}
                onMouseDown={preventClosing}
                onMouseUp={cancelClosingPrevention}
                onTouchStart={preventClosing}
                onTouchEnd={cancelClosingPrevention}
                onClick={() => {
                    console.debug('onClick');
                    selectItem(item);
                }}
            >
                {textNodes}
            </li>
        );
    });

    if (renderList.length === 0) {
        renderList.push(
            <li key={'empty'} className={styles.empty}>
                {intl.formatMessage({ id: 'app.items.nothing_found' })}
            </li>
        );
    }

    return (
        <section className={styles.dropdown} ref={ref}>
            <ul>{renderList}</ul>
        </section>
    );
}

const Dropdown = React.forwardRef(DropdownInner);

interface SeekerProps<Item> {
    placeholder?: string;
    maxSuggestions?: number;
    showEverything?: boolean;
    items: Item[];
    nameKey?: keyof Item;
    idKey?: keyof Item;
    selectedItem?: Item | null;
    onSelect: (item: Item | null) => void;
    autocompleteOnBlur?: boolean;
    className?: string;
}

export function Seeker<Item extends { [key: string]: any }>({
    className,
    placeholder = '',
    maxSuggestions = 6,
    showEverything = false,
    nameKey,
    idKey,
    autocompleteOnBlur = true,
    selectedItem = null,
    onSelect,
    items,
}: SeekerProps<Item>) {
    let realInput = useRef<HTMLInputElement>(null);
    let dropDown = useRef<HTMLDivElement>(null);
    let shouldLoseFocus = useRef(true);

    let _nameKey = (nameKey || 'name') as string;
    let _idKey = (idKey || 'id') as string;

    if (nameKey === undefined) {
        throw new Error('nameKey is undefined');
    }

    let [focused, setFocused] = useState(false);
    let [showDropdown, setShowDropdown] = useState(false);
    let [inputValue, setInputValue] = useState('');
    let [regex, setRegex] = useState<null | RegExp>(null);
    let [preselectedItem, setPreselectedItem] = useState<Item | null>(null);
    let [pointerPosition, setPointerPosition] = useState<number>(-1);
    let [availableToSelect, setAvailableToSelect] = useState<Item[]>([]);

    let preventClosing = useCallback(
        (e: React.MouseEvent | React.TouchEvent | null) => {
            if (e !== null) {
                console.debug('%c[cb] Prevent closing', _colorCb, e.target);
                e.stopPropagation();
            } else {
                console.debug('%c[cb] Prevent closing', _colorCb);
            }

            shouldLoseFocus.current = false;
        },
        [shouldLoseFocus]
    );

    let cancelClosingPrevention = useCallback(
        (e: React.MouseEvent | React.TouchEvent | null) => {
            if (e !== null) {
                console.debug('%c[cb] Cancel closing prevention', _colorCb, e.target);
                e.stopPropagation();
            } else {
                console.debug('%c[cb] Cancel closing prevention', _colorCb);
            }

            shouldLoseFocus.current = true;
        },
        [shouldLoseFocus]
    );

    const selectItem = useCallback(
        (item: Item | null) => {
            console.debug('%c[cb] Item selected:', _colorCb, item);
            if (item !== null) {
                onSelect({ ...item });
            } else {
                onSelect(null);
            }
        },
        [onSelect]
    );

    const inputGetFocus = useCallback(() => {
        console.debug('%c[cb] Input got focus', _colorCb);
        setFocused(true);
    }, []);

    const inputLoseFocus = useCallback(() => {
        console.debug('%c[cb] Input lose focus, best candidate to select:', _colorCb, preselectedItem);
        if (autocompleteOnBlur && shouldLoseFocus.current && preselectedItem !== null) {
            console.debug('%c[cb] calling callback with item (onBlur):', _colorCb, preselectedItem);
            selectItem(preselectedItem);
        } else if (preselectedItem !== null && selectedItem !== null && shouldLoseFocus.current) {
            console.debug('%c[cb] reset to :', _colorCb, selectedItem);
            selectItem(selectedItem);
        }

        if (shouldLoseFocus.current) {
            setFocused(false);
        }
    }, [autocompleteOnBlur, preselectedItem, selectItem, selectedItem]);

    const inputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            let value = inputEscapingMap.reduce((acc, pair) => {
                return acc.replace(pair[0], pair[1]);
            }, event.target.value);

            const parts = value.trim().split(' ');
            let regexBase = parts.reduce((regexBase, part, index) => (part.length > 0 ? (regexBase += `(^|.*?\\s·)(${part})`) : regexBase), '');

            setInputValue(value);
            if (regexBase === '') {
                setRegex(null);
                setPointerPosition(-1);
                onSelect(null);
            } else {
                setRegex(new RegExp(regexBase, 'ig'));
            }
        },
        [onSelect]
    );

    const clearInput = useCallback(() => {
        console.debug('%c[cb] Clear input', _colorCb);
        setInputValue('');
        setRegex(null);
        setPointerPosition(-1);
        onSelect(null);
        setFocused(true);
    }, [onSelect]);

    const inputKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    if (pointerPosition < availableToSelect.length - 1) {
                        setPointerPosition(pointerPosition + 1);
                    }

                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    if (pointerPosition > -1) {
                        setPointerPosition(pointerPosition - 1);
                    }

                    break;
                case 'ArrowRight':
                case 'Enter':
                    if (preselectedItem !== null) {
                        event.preventDefault();
                        selectItem(preselectedItem);
                    }

                    break;

                case 'Escape':
                    event.preventDefault();
                    if (selectedItem !== null) {
                        setInputValue(selectedItem[_nameKey] as unknown as string);
                    } else {
                        setInputValue('');
                    }

                    setRegex(null);
                    setPointerPosition(-1);
            }
        },
        [pointerPosition, preselectedItem, availableToSelect, selectedItem, _nameKey, selectItem]
    );

    const dropDownClick = useCallback(() => {
        setShowDropdown(!showDropdown);
        setFocused(!showDropdown);
    }, [showDropdown]);

    // Calculate which items are available to select, based on the user current input
    // they are sorted by number of letters matched, then by alphabetical order and group priority
    useEffect(() => {
        console.debug('%c[effect] Recalculate available to select', _colorEffect);
        let itemMatchPairs = items
            .map<[number, Item]>((item) => {
                if (regex === null) {
                    return [1, item];
                }

                let name = item[_nameKey] as unknown as string;
                let matchedlenght = name.match(regex)?.[0].length || 0;
                return [matchedlenght, item];
            })
            .filter((pair) => {
                return pair[0] > 0;
            });

        itemMatchPairs.sort((a, b) => {
            let matchLenghtA = a[0];
            let matchLenghtB = b[0];
            let itemA = a[1];
            let itemB = b[1];
            let aName = itemA[_nameKey] as unknown as string;
            let bName = itemB[_nameKey] as unknown as string;
            let aGroup: keyof typeof groupPriority = itemA.group || 'without';
            let bGroup: keyof typeof groupPriority = itemB.group || 'without';

            if (aGroup === bGroup) {
                if (matchLenghtA === matchLenghtB) {
                    return aName.localeCompare(bName);
                }

                return matchLenghtA - matchLenghtB;
            }

            let aPriority = groupPriority[aGroup] || groupPriority.with;
            let bPriority = groupPriority[bGroup] || groupPriority.with;
            if (aPriority === bPriority) {
                return aGroup.localeCompare(bGroup);
            }

            return aPriority - bPriority;
        });

        // Create array of items from or sorted pairs
        let availableToSelect = itemMatchPairs.map((pair) => pair[1]);

        if (!showEverything) {
            availableToSelect = availableToSelect.slice(0, maxSuggestions);
        }

        setAvailableToSelect(availableToSelect);
    }, [items, regex, _nameKey, showEverything, maxSuggestions]);

    // Trying to figure out the best match fro given input
    // This best match is candidate to be selected and thrown into `onSelect` callback
    useEffect(() => {
        console.group('%c[effect] Trying to find the best match', _colorEffect);
        if (availableToSelect.length > 0 && (regex !== null || pointerPosition >= 0)) {
            let pointerAt = pointerPosition < 0 ? 0 : pointerPosition;
            console.debug(availableToSelect[pointerAt]);
            setPreselectedItem(availableToSelect[pointerAt]);
        } else {
            console.debug('no suggestions');
            setPreselectedItem(null);
        }

        console.groupEnd();
    }, [availableToSelect, pointerPosition, regex]);

    // New item was selected, update input field
    useEffect(() => {
        console.debug('%c[effect] Selected item changed', _colorEffect, selectedItem);
        if (selectedItem !== null) {
            setInputValue(selectedItem[_nameKey] as unknown as string);
        } else {
            setInputValue('');
        }

        setRegex(null);
        setPointerPosition(-1);
    }, [selectedItem, _nameKey]);

    // Keep focus on input field if user is working with Seeker
    useEffect(() => {
        console.debug('%c[effect] Keep focus on input field if user is working with Seeker', _colorEffect);
        if (focused && realInput.current !== document.activeElement) {
            realInput.current?.focus();
            const end = realInput.current?.value.length;
            if (end !== undefined) {
                realInput.current?.setSelectionRange(end, end);
            }
        }
    }, [focused, selectedItem, showDropdown]);

    // Should open dropdown or not (or keep it opened)
    useEffect(() => {
        console.debug('%c[effect] Should open dropdown or not', _colorEffect);
        if (focused && (regex !== null || selectedItem === null)) {
            setShowDropdown(true);
        } else {
            setShowDropdown(false);
        }
    }, [focused, regex, selectedItem]);

    // Scroll to the selected item inside dropdown list
    useEffect(() => {
        if (showDropdown && pointerPosition !== -1) {
            const selectedLi = dropDown.current?.firstChild?.childNodes[pointerPosition] as HTMLLIElement;
            const parent = dropDown.current?.firstChild as HTMLUListElement;
            if (parent?.scrollHeight > parent?.offsetHeight) {
                selectedLi?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [showDropdown, pointerPosition]);

    let cNames = classNames(styles.seeker, {
        [styles.focused]: focused,
        [styles.error]: items.length > 0 && regex !== null && preselectedItem === null,
        [`${className}`]: className !== undefined,
    });

    let showSelector = selectedItem === null && regex === null;

    return (
        <div className={cNames}>
            <section className={classNames(styles.input)}>
                <span className={styles.realInput}>
                    <input
                        type='text'
                        placeholder={placeholder}
                        onBlur={inputLoseFocus}
                        onChange={inputChange}
                        onKeyDown={inputKeyDown}
                        onFocus={inputGetFocus}
                        onClick={stopPropagation}
                        ref={realInput}
                        value={inputValue}
                    />
                </span>
                <Suggestion preselectedItemName={preselectedItem?.[_nameKey] || ''} inputValue={inputValue} />
            </section>
            {!showSelector && (
                <button
                    className={classNames('btn', styles.actionButton, styles.clearAll)}
                    type={'button'}
                    onClick={clearInput}
                    tabIndex={0}
                    onMouseDown={preventClosing}
                    onMouseUp={cancelClosingPrevention}
                    onTouchStart={preventClosing}
                    onTouchEnd={cancelClosingPrevention}
                >
                    <Icon svgSymbol={backspaceIcon} />
                </button>
            )}
            {showEverything && showSelector && (
                <button
                    className={classNames('btn', styles.actionButton, styles.showAll, { [styles.rotate]: showDropdown })}
                    type={'button'}
                    onClick={dropDownClick}
                    onKeyDown={inputKeyDown}
                    onMouseDown={preventClosing}
                    onMouseUp={cancelClosingPrevention}
                    onTouchStart={preventClosing}
                    onTouchEnd={cancelClosingPrevention}
                    tabIndex={0}
                >
                    <Icon svgSymbol={chevronDownIcon} />
                </button>
            )}
            {showDropdown && (
                <Dropdown
                    availableToSelect={availableToSelect}
                    pointerPosition={pointerPosition}
                    regex={regex}
                    nameKey={_nameKey}
                    idKey={_idKey}
                    ref={dropDown}
                    preventClosing={preventClosing}
                    cancelClosingPrevention={cancelClosingPrevention}
                    selectItem={selectItem}
                />
            )}
        </div>
    );
}
