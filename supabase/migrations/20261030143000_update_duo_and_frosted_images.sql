UPDATE public.products
SET image = 'assets/cuff-frosted-new.jpg',
    image_frost = 'assets/cuff-frosted-new.jpg'
WHERE id = 'cuff-01-frost';

UPDATE public.products
SET image_frost = 'assets/cuff-frosted-new.jpg'
WHERE id = 'cuff-01';

UPDATE public.products
SET image = 'assets/cuff-duo-new.jpg',
    image_angle = 'assets/cuff-duo-new.jpg',
    image_frost = 'assets/cuff-duo-new.jpg',
    image_engraved = 'assets/cuff-duo-new.jpg',
    image_frost_engraved = 'assets/cuff-duo-new.jpg'
WHERE id = 'duo-01';
