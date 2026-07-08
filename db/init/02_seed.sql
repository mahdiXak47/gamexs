-- Reference/lookup data. Matches frontend/src/lib/sellers.ts — once the
-- frontend reads from this database instead of its mock data, that file's
-- registry becomes redundant and can be deleted.

INSERT INTO platforms (slug, name) VALUES
    ('ps5', 'PlayStation 5');

INSERT INTO sellers (slug, name, domain) VALUES
    ('pspro', 'PSPro', 'pspro.ir'),
    ('yungcenter', 'YungCenter', 'yungcenter.com'),
    ('nakhlmarket', 'نخل مارکت', 'nakhlmarket.com'),
    ('technolife', 'تکنولایف', 'technolife.com'),
    ('persianconsole', 'پرشین کنسول', 'persianconsole.ir'),
    ('gameplayshop', 'گیم‌پلی‌شاپ', 'gameplayshop.ir'),
    ('digikala', 'دیجی‌کالا', 'digikala.com'),
    ('parsconsole', 'پارس کنسول', 'parsconsole.com'),
    ('gameonestore', 'گیم‌وان استور', 'gameonestore.com'),
    ('xgamesstore', 'XGames', 'xgamesstore.org'),
    ('gamecenter', 'گیم سنتر', 'game-center.ir'),
    ('gamario', 'Gamario', 'gamario.com'),
    ('cdkeyshare', 'سی‌دی‌کی‌شر', 'cdkeyshare.ir');
