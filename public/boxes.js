// Streaming box builder: box (one-time setup & activation) + rate plan
// (monthly, annual 1–5, or lifetime 1/5 with $50 off the bundle).
// Shows the total and links to checkout. The server sets the real price.
(function () {
  var form = document.getElementById('box-builder');
  if (!form) return;
  var monthly = Number(form.dataset.monthly);
  var annual = form.dataset.annual.split(',').map(Number);
  var lifetime = (form.dataset.lifetime || '').split(',').map(Number);
  var lifetimeConns = (form.dataset.lifetimeConns || '').split(',').map(Number);
  var discount = Number(form.dataset.lifetimeDiscount) || 0;
  var annualPick = document.getElementById('box-annual-pick');
  var lifetimePick = document.getElementById('box-lifetime-pick');
  var screens = document.getElementById('box-screens');
  var lifeScreens = document.getElementById('box-lifetime');
  var $ = function (id) { return document.getElementById(id); };
  var plural = function (n) { return n + ' connection' + (n > 1 ? 's' : ''); };

  function update() {
    var box = form.querySelector('input[name=box]:checked');
    var rateKind = form.querySelector('input[name=rate]:checked').value;
    var fee = Number(box.dataset.fee);
    var rate, label, planKey, then, off = 0;
    if (rateKind === 'annual') {
      var n = Number(screens.value) || 1;
      rate = annual[n - 1];
      label = 'Annual · ' + plural(n);
      planKey = 'annual-' + n;
      then = 'Then $' + rate + '/year. The setup fee is one time only. US shipping.';
    } else if (rateKind === 'lifetime') {
      var c = Number(lifeScreens.value) || 1;
      rate = lifetime[Math.max(0, lifetimeConns.indexOf(c))];
      label = 'Lifetime · ' + plural(c);
      planKey = 'lifetime-' + c;
      off = discount;
      then = 'One-time payment. No renewals, no monthly bills. US shipping.';
    } else {
      rate = monthly;
      label = 'Monthly · 1 connection';
      planKey = 'monthly';
      then = 'Then $' + rate + '/month. The setup fee is one time only. US shipping.';
    }
    var total = fee + rate - off;
    annualPick.hidden = rateKind !== 'annual';
    if (lifetimePick) lifetimePick.hidden = rateKind !== 'lifetime';
    $('box-sum-box').innerHTML = box.dataset.name + ' setup &amp; activation <small>(one-time)</small>';
    $('box-sum-fee').textContent = '$' + fee;
    $('box-sum-plan').textContent = label;
    $('box-sum-rate').textContent = '$' + rate;
    var discRow = $('box-sum-discount-row');
    if (discRow) { discRow.hidden = !off; $('box-sum-discount').textContent = '−$' + off; }
    $('box-sum-total').textContent = '$' + total;
    var order = $('box-order');
    order.href = '/pay?plan=box-' + box.value + '-' + planKey;
    order.innerHTML = 'Order my box · $' + total + ' <span>↗</span>';
    $('box-sum-then').textContent = then;
  }

  form.addEventListener('change', update);
  update();
})();
