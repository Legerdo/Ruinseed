// Temporary font rendering check scene (development only)
(function () {
  RS.Scenes = RS.Scenes || {};
  RS.Scenes.fonttest = {
    enter() {},
    update() {},
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      ctx.fillStyle = RS.PAL.ink1; ctx.fillRect(0, 0, W, H);
      let y = 6;
      RS.Text.draw(ctx, '새 세계 · 같은 세계 재도전 · 계속하기 · 설정', 6, y, { font: 'body', color: RS.PAL.bone6 }); y += 16;
      RS.Text.draw(ctx, '굵게: 폐허의 수호자가 깨어났다!', 6, y, { font: 'bold', color: RS.PAL.gold4, outline: RS.PAL.ink0 }); y += 16;
      RS.Text.draw(ctx, '작은 글씨: 인장 1/3 · 불씨 128', 6, y, { font: 'small', color: RS.PAL.moss8 }); y += 13;
      RS.Text.draw(ctx, 'Ruinseed 0123456789', 6, y, { font: 'large', color: RS.PAL.emb5, shadow: RS.PAL.emb1 }); y += 20;
      RS.Text.drawWrapped(ctx, '긴 문장 줄바꿈 시험: 세 개의 고대 인장을 모아 수호자의 봉인을 풀고, 부서진 세계의 심장부로 향하라. 아주아주길어서한줄에들어가지않는단어도처리해야한다.', 6, y, 200, { font: 'body', color: RS.PAL.bone5 });
    }
  };
})();
