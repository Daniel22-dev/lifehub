import { $, $$, uid } from './utils.js';

export function toast(message, type = 'good') {
  const wrap = $('#toastWrap');
  if (!wrap) return;
  const box = document.createElement('div');
  box.className = `toast ${type}`;
  box.textContent = message;
  wrap.appendChild(box);
  setTimeout(() => {
    box.style.opacity = '0';
    box.style.transform = 'translateY(10px)';
  }, 4200);
  setTimeout(() => box.remove(), 4700);
}

export function download(name, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 300);
}

export function modalDialog({
  title = 'Potvrzení',
  message = '',
  confirmText = 'OK',
  cancelText = 'Zrušit',
  danger = false,
  fields = [],
  validate = null
} = {}) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const screen = document.createElement('div');
    screen.className = 'modal-screen active';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');

    const card = document.createElement('form');
    card.className = 'modal-card';

    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.id = uid('modal_title');
    screen.setAttribute('aria-labelledby', heading.id);

    const text = document.createElement('p');
    text.className = 'modal-message';
    text.textContent = message;

    const fieldWrap = document.createElement('div');
    fieldWrap.className = fields.length ? 'modal-fields' : 'hide';
    const inputs = {};

    fields.forEach(field => {
      const label = document.createElement('label');
      label.textContent = field.label || '';
      const input = document.createElement('input');
      input.type = field.type || 'text';
      input.autocomplete = field.autocomplete || 'off';
      input.minLength = field.minLength || 0;
      input.required = field.required !== false;
      input.placeholder = field.placeholder || '';
      input.value = field.value || '';
      label.appendChild(input);
      fieldWrap.appendChild(label);
      inputs[field.name] = input;
    });

    const status = document.createElement('div');
    status.className = 'modal-status';

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = cancelText;

    const ok = document.createElement('button');
    ok.type = 'submit';
    ok.className = danger ? 'btn danger' : 'btn primary';
    ok.textContent = confirmText;

    actions.append(cancel, ok);
    card.append(heading, text, fieldWrap, status, actions);
    screen.appendChild(card);
    document.body.appendChild(screen);

    const cleanup = result => {
      screen.removeEventListener('keydown', onKeydown);
      screen.remove();
      try {
        previousFocus?.focus?.();
      } catch (error) {
        // Ignore focus restore issues when the original element disappeared.
      }
      resolve(result);
    };

    const onKeydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = $$('button,input,select,textarea,a[href]', screen).filter(el => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    screen.addEventListener('keydown', onKeydown);
    cancel.addEventListener('click', () => cleanup(null));
    card.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
      const error = validate ? validate(values) : '';
      if (error) {
        status.textContent = error;
        return;
      }
      cleanup(fields.length ? values : true);
    });

    setTimeout(() => {
      (Object.values(inputs)[0] || ok).focus();
    }, 0);
  });
}

export function confirmDialog(message, {
  title = 'Potvrzení',
  confirmText = 'Pokračovat',
  cancelText = 'Zrušit',
  danger = false
} = {}) {
  return modalDialog({ title, message, confirmText, cancelText, danger }).then(Boolean);
}

export function passwordDialog({
  title = 'Heslo',
  message = '',
  repeat = false,
  minLength = 1,
  confirmText = 'Pokračovat'
} = {}) {
  const fields = [
    {
      name: 'password',
      label: 'Heslo',
      type: 'password',
      autocomplete: 'new-password',
      minLength,
      required: true,
      placeholder: minLength > 1 ? `Minimálně ${minLength} znaků` : ''
    }
  ];

  if (repeat) {
    fields.push({
      name: 'passwordRepeat',
      label: 'Zopakovat heslo',
      type: 'password',
      autocomplete: 'new-password',
      minLength,
      required: true
    });
  }

  return modalDialog({
    title,
    message,
    fields,
    confirmText,
    validate: values => {
      if (!values.password) return 'Zadejte heslo.';
      if (minLength && values.password.length < minLength) return `Heslo musí mít alespoň ${minLength} znaků.`;
      if (repeat && values.password !== values.passwordRepeat) return 'Hesla se neshodují.';
      return '';
    }
  }).then(values => values ? values.password : '');
}
