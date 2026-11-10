/* ============ GM Service — вход администратора ============ */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('cmsLoginForm');
  if (!form) return;

  var msg = document.getElementById('cmsLoginMsg');
  var submit = form.querySelector('button[type="submit"]');
  var emailInput = form.querySelector('input[name="email"]');
  var passwordInput = form.querySelector('input[name="password"]');
  var resume = document.getElementById('cmsResume');
  var resumeEmail = document.getElementById('cmsResumeEmail');
  var logoutBtn = document.getElementById('cmsLogout');

  function setMsg(text, isError) {
    msg.textContent = text;
    msg.className = 'cms-msg' + (isError ? ' error' : '');
  }

  if (!window.GMCMS || !window.GMCMS.configured) {
    form.querySelectorAll('input, button').forEach(function (el) { el.disabled = true; });
    setMsg('CMS ещё не подключена. Заполните assets/js/config.js — инструкция в README-admin.md.', true);
    return;
  }

  var session = window.GMCMS.getSession();

  if (session && session.access_token) {
    resume.hidden = false;
    resumeEmail.textContent = session.email || 'администратор';
  }

  logoutBtn.addEventListener('click', function () {
    window.GMCMS.clearSession();
    location.reload();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    var password = passwordInput.value;

    if (!email || !password) {
      setMsg('Введите e-mail и пароль.', true);
      return;
    }

    setMsg('Входим…');
    submit.disabled = true;

    window.GMCMS.signIn(email, password).then(function (res) {
      submit.disabled = false;
      if (!res.ok) {
        setMsg('Не удалось войти: ' + res.error, true);
        return;
      }
      passwordInput.value = '';
      location.href = 'index.html?edit=1';
    });
  });
});
